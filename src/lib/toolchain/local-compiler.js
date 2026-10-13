'use strict';
const path = require('path');
const fs = require('fs-extra');
const execa = require('execa');
const temp = require('temp').track();
const { Spinner } = require('cli-spinner');
const UI = require('../ui');
const { fetchManifest, hostFor, displayName } = require('./manifest');
const { ToolchainInstaller } = require('./installer');

const BUILD_TARGETS = ['compile-user', 'compile-all', 'clean-user', 'clean-all'];
const WHITESPACE = /\s/;

/**
 * Compiles a project with the toolchain Workbench installs: `make -f <buildscripts
 * Makefile> compile-user` with the environment the Makefile documents. The project
 * directory is handed to `make` as is, so builds are incremental and `.ino` files are
 * preprocessed next to their sources, exactly as Workbench does.
 */
class LocalCompiler {
	/**
	 * @param {object} [opts]
	 * @param {UI} [opts.ui]
	 * @param {ToolchainInstaller} [opts.installer]
	 * @param {function} [opts.fetchManifest]
	 * @param {function} [opts.exec] execa-compatible spawner, replaceable in tests
	 * @param {{ platform: string, arch: string }} [opts.host] overrides the running machine
	 */
	constructor({ ui = new UI(), installer, fetchManifest: fetchManifestFn = fetchManifest, exec = execa, host } = {}) {
		this.ui = ui;
		this.installer = installer || new ToolchainInstaller({ ui });
		this.fetchManifest = fetchManifestFn;
		this.exec = exec;
		this.host = hostFor(host);
	}

	/**
	 * Picks the toolchain for a version and platform, installing what is missing.
	 * @param {{ version?: string, platformId: number, platformName: string }} opts
	 * @returns {Promise<{ toolchain: object, dependencies: object[], platform: object }>}
	 */
	async resolve({ version, platformId, platformName }) {
		let manifest = await this.fetchManifest();
		if (!this._knows(manifest, { version, platformId, platformName })) {
			// the cached copy may predate a new Device OS release or platform
			manifest = await this.fetchManifest({ maxAgeMs: 0 });
		}
		const platform = manifest.platform(platformId);
		if (!platform) {
			throw new Error(`The local toolchain does not support ${platformName}; use --compiler cloud`);
		}
		const toolchain = manifest.resolveToolchain({ version, platformId, platformName });
		const dependencies = manifest.dependenciesFor(toolchain, this.host);
		this._write(`Targeting version: ${toolchain.version}`);
		await this.installer.ensureInstalled(dependencies, {
			label: `Local toolchain for Device OS ${toolchain.version} (${platform.name})`
		});
		return { toolchain, dependencies, platform };
	}

	/**
	 * Compiles `projectDir` and returns the artifact the Makefile produced.
	 * @param {object} opts
	 * @param {string} opts.projectDir absolute path, becomes APPDIR
	 * @param {number} opts.platformId
	 * @param {string} opts.platformName
	 * @param {string} [opts.version] Device OS version; default or `latest` picks the manifest default
	 * @param {string} [opts.target] make target, `compile-user` by default
	 * @param {string} [opts.assetOtaDir] raw `assetOtaDir` from project.properties
	 * @param {boolean} [opts.verbose]
	 * @returns {Promise<{ filename: string, isBundle: boolean, version: string, targetDir: string }>}
	 */
	async compile({ projectDir, platformId, platformName, version, target = 'compile-user', assetOtaDir, verbose = false }) {
		if (!BUILD_TARGETS.includes(target)) {
			throw new Error(`Unknown build target ${target}; expected one of ${BUILD_TARGETS.join(', ')}`);
		}
		if (WHITESPACE.test(projectDir)) {
			throw new Error(`Local compile does not support project paths with whitespace: ${projectDir}`);
		}
		const { toolchain, dependencies, platform } = await this.resolve({ version, platformId, platformName });
		const cliPath = await this.cliExecutable();
		const execOptions = this.buildExecOptions({ dependencies, platform, projectDir, cliPath, target, assetOtaDir, verbose });

		this._write('');
		if (!verbose && !(await this.isDeviceOsBuilt({ dependencies, platform }))) {
			this._write(`Building Device OS ${toolchain.version} for ${platform.name} for the first time. This takes a few minutes with no output; later compiles reuse it. Use -vv to see the make output.`);
		}
		await this.run(execOptions, { spin: !verbose });

		const artifact = await this.artifactFor({ projectDir, version: toolchain.version, platformName: platform.name });
		return { ...artifact, version: toolchain.version };
	}

	/**
	 * The `make` invocation and environment, as Workbench builds them.
	 * @returns {{ command: string, args: string[], options: object }}
	 */
	buildExecOptions({ dependencies, platform, projectDir, cliPath, target, assetOtaDir, verbose }) {
		const [firmware, compiler, tools, scripts] = dependencies;
		const compilerDir = this.installer.dirFor(compiler);
		const toolsDir = this.installer.dirFor(tools);
		const deviceOsDir = this.installer.dirFor(firmware);
		const makefile = path.join(this.installer.dirFor(scripts), 'Makefile');
		const isWindows = this.host.os === 'windows';
		const posix = p => (isWindows ? p.replace(/\\/g, '/') : p);

		const pathKey = Object.keys(process.env).find(k => k.toUpperCase() === 'PATH') || 'PATH';
		const pathDirs = [compilerDir, toolsDir, isWindows ? path.join(toolsDir, 'bin') : null, path.dirname(cliPath)].filter(Boolean);
		const env = {
			[pathKey]: [...pathDirs, process.env[pathKey]].filter(Boolean).join(path.delimiter),
			PLATFORM: platform.name,
			PLATFORM_ID: `${platform.id}`,
			PARTICLE_DEVICE_ID: '',
			APPDIR: posix(projectDir),
			EXTRA_CFLAGS: '',
			PARTICLE_CLI_PATH: posix(cliPath),
			DEVICE_OS_PATH: posix(deviceOsDir),
			DEVICE_OS_VERSION: firmware.version,
			// GCC_ARM_PATH must end with a slash: device-os build/common-tools.mk
			GCC_ARM_PATH: posix(path.join(compilerDir, path.sep)),
			PARTICLE_LOCAL_COMPILER_DEBUG: verbose ? '1' : '0',
			// let the child `particle` run outside the pkg snapshot, see container.js
			PKG_EXECPATH: ''
		};
		if (assetOtaDir) {
			env.ASSET_OTA_DIR = assetOtaDir;
		}

		const args = ['-f', `'${posix(makefile)}'`, target];
		if (!verbose) {
			args.push('-s');
		}
		const shell = isWindows ? this._windowsBash(tools) : '/bin/bash';
		return {
			command: 'make',
			args,
			options: { cwd: projectDir, env, shell }
		};
	}

	/**
	 * Runs make, streaming its output; a non-zero exit becomes an error.
	 * With `spin` on a terminal, a spinner with the elapsed time fills the silences of make -s.
	 */
	async run({ command, args, options }, { spin = false } = {}) {
		const child = this.exec(command, args, { ...options, reject: false, stdin: 'ignore' });
		const spinner = spin && !this.ui.quiet && this.ui.stdout.isTTY ? new MakeSpinner(this.ui.stdout) : null;
		const forward = stream => chunk => {
			if (spinner) {
				spinner.pause();
			}
			stream.write(chunk);
			if (spinner) {
				spinner.resumeAfter(chunk);
			}
		};
		if (child.stdout && !this.ui.quiet) {
			child.stdout.on('data', forward(this.ui.stdout));
		}
		if (child.stderr) {
			child.stderr.on('data', forward(this.ui.stderr));
		}
		let result;
		try {
			if (spinner) {
				spinner.resume();
			}
			result = await child;
		} finally {
			if (spinner) {
				spinner.pause();
			}
		}
		if (result.failed || result.exitCode !== 0) {
			throw new Error(`make exited with code ${result.exitCode}`);
		}
		return result;
	}

	/**
	 * Where the Makefile leaves the build: `<project>/target/<version>/<platform>/<basename>.bin`,
	 * or `.zip` when the project has assets or env and the Makefile bundled it.
	 */
	async artifactFor({ projectDir, version, platformName }) {
		const targetDir = path.join(projectDir, 'target', version, platformName);
		const name = path.basename(projectDir);
		const zip = path.join(targetDir, `${name}.zip`);
		const bin = path.join(targetDir, `${name}.bin`);
		if (await fs.pathExists(zip)) {
			return { filename: zip, isBundle: true, targetDir };
		}
		if (await fs.pathExists(bin)) {
			return { filename: bin, isBundle: false, targetDir };
		}
		throw new Error(`make finished but no ${name}.bin or ${name}.zip was found in ${targetDir}`);
	}

	/**
	 * The `particle` the Makefile calls back into for `preprocess` and `bundle`: the
	 * packaged binary itself, or a small script that runs this checkout with this node.
	 * @returns {Promise<string>}
	 */
	async cliExecutable() {
		if (process.pkg) {
			return process.execPath;
		}
		if (this._wrapper) {
			return this._wrapper;
		}
		const entry = path.resolve(__dirname, '..', '..', 'index.js');
		const dir = temp.mkdirSync('particle-cli-local-compile');
		const wrapper = path.join(dir, 'particle');
		const posix = p => p.replace(/\\/g, '/');
		// make runs this through sh (bash from buildtools on Windows), so LF endings even on Windows.
		await fs.writeFile(wrapper, `#!/bin/sh\nexec "${posix(process.execPath)}" "${posix(entry)}" "$@"\n`, { mode: 0o755 });
		this._wrapper = wrapper;
		return wrapper;
	}

	/**
	 * make -s is silent while it builds the Device OS libraries a user part links against.
	 * They are built once per version and platform, under <deviceOS>/build/target/<lib>/platform-<id>-m.
	 */
	async isDeviceOsBuilt({ dependencies, platform }) {
		const [firmware] = dependencies;
		const wiringDir = path.join(this.installer.dirFor(firmware), 'build', 'target', 'wiring');
		const entries = await fs.readdir(wiringDir).catch(() => []);
		return entries.some(entry => entry === `platform-${platform.id}` || entry.startsWith(`platform-${platform.id}-`));
	}

	/** buildtools ships its own bash on Windows; the manifest may say where. */
	_windowsBash(tools) {
		const declared = tools.paths && tools.paths.bash && tools.paths.bash.path;
		return path.join(this.installer.rootFor(tools), declared || 'bin/bash.exe');
	}

	_knows(manifest, { version, platformId, platformName }) {
		if (!manifest.platform(platformId)) {
			return false;
		}
		try {
			manifest.resolveToolchain({ version, platformId, platformName });
			return true;
		} catch (_error) {
			return false;
		}
	}

	_write(message) {
		if (!this.ui.quiet) {
			this.ui.write(message);
		}
	}
}

/** A "Compiling" spinner with the elapsed time that clears its line whenever make writes. */
class MakeSpinner {
	constructor(stream) {
		const startedAt = Date.now();
		this.spinner = new Spinner({
			stream,
			text: '%s Compiling...',
			onTick: (message) => {
				this.spinner.clearLine(stream);
				stream.write(`${message} ${formatElapsed(Date.now() - startedAt)}`);
			}
		});
	}

	resume() {
		if (!this.spinner.isSpinning()) {
			this.spinner.start();
		}
	}

	pause() {
		if (this.spinner.isSpinning()) {
			this.spinner.stop(true);
		}
	}

	/** Restarts only after a whole line, so the spinner never overwrites a partial one. */
	resumeAfter(chunk) {
		if (String(chunk).endsWith('\n')) {
			this.resume();
		}
	}
}

function formatElapsed(ms) {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	return minutes ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
}

module.exports = {
	LocalCompiler,
	BUILD_TARGETS,
	displayName
};
