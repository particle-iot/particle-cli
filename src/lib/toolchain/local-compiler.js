'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const execa = require('execa');
const temp = require('temp').track();
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
		const manifest = await this.fetchManifest();
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
		await this.run(execOptions);

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

	/** Runs make, streaming its output; a non-zero exit becomes an error. */
	async run({ command, args, options }) {
		const child = this.exec(command, args, { ...options, reject: false, stdin: 'ignore' });
		if (child.stdout && !this.ui.quiet) {
			child.stdout.pipe(this.ui.stdout);
		}
		if (child.stderr) {
			child.stderr.pipe(this.ui.stderr);
		}
		const result = await child;
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
		await fs.writeFile(wrapper, `#!/bin/sh${os.EOL}exec "${posix(process.execPath)}" "${posix(entry)}" "$@"${os.EOL}`, { mode: 0o755 });
		this._wrapper = wrapper;
		return wrapper;
	}

	/** buildtools ships its own bash on Windows; the manifest may say where. */
	_windowsBash(tools) {
		const declared = tools.paths && tools.paths.bash && tools.paths.bash.path;
		return path.join(this.installer.rootFor(tools), declared || 'bin/bash.exe');
	}

	_write(message) {
		if (!this.ui.quiet) {
			this.ui.write(message);
		}
	}
}

module.exports = {
	LocalCompiler,
	BUILD_TARGETS,
	displayName
};
