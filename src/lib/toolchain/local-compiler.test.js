'use strict';
const path = require('path');
const { PassThrough } = require('stream');
const fs = require('fs-extra');
const { expect, sinon } = require('../../../test/setup');
const { PATH_TMP_DIR, PATH_FIXTURES_DIR } = require('../../../test/lib/env');
const UI = require('../ui');
const { ToolchainManifest } = require('./manifest');
const { ToolchainInstaller } = require('./installer');
const { LocalCompiler, BUILD_TARGETS } = require('./local-compiler');

describe('Local compiler', () => {
	const toolchainDir = path.join(PATH_TMP_DIR, 'toolchains-under-test');
	const projectDir = path.join(PATH_TMP_DIR, 'blinky');
	let manifest, ui, installer, exec, compiler;

	before(async () => {
		manifest = new ToolchainManifest(await fs.readJson(path.join(PATH_FIXTURES_DIR, 'toolchain', 'manifest.json')));
	});

	beforeEach(async () => {
		await fs.remove(toolchainDir);
		await fs.ensureDir(projectDir);
		ui = new UI({ stdout: new PassThrough(), stderr: new PassThrough(), quiet: false });
		sinon.stub(ui, 'write');
		installer = new ToolchainInstaller({ ui, toolchainDir });
		sinon.stub(installer, 'ensureInstalled').resolves({ installed: [], skipped: [] });
		exec = sinon.stub().callsFake(fakeMake({ exitCode: 0 }));
		compiler = new LocalCompiler({
			ui,
			installer,
			exec,
			fetchManifest: async () => manifest,
			host: { platform: 'linux', arch: 'x64' }
		});
		sinon.stub(compiler, 'cliExecutable').resolves('/opt/particle/bin/particle');
	});

	afterEach(async () => {
		sinon.restore();
		await fs.remove(projectDir);
		await fs.remove(toolchainDir);
	});

	// an execa-like stub: streams, then resolves like execa with reject: false would
	function fakeMake({ exitCode, onRun }) {
		return (command, args, options) => {
			const stdout = new PassThrough();
			const stderr = new PassThrough();
			const promise = (async () => {
				if (onRun) {
					await onRun({ command, args, options });
				}
				stdout.end('make output\n');
				stderr.end();
				return { exitCode, failed: exitCode !== 0 };
			})();
			promise.stdout = stdout;
			promise.stderr = stderr;
			return promise;
		};
	}

	function argonDeps() {
		return manifest.dependenciesFor(manifest.toolchainForVersion('6.4.1'), { os: 'linux', arch: 'x64' });
	}

	it('refuses hosts without a toolchain up front', () => {
		expect(() => new LocalCompiler({ ui, host: { platform: 'linux', arch: 'arm64' } }))
			.to.throw('Local compile is not available for linux/arm64; use --compiler cloud');
	});

	describe('resolve', () => {
		it('picks the default toolchain, prints it and installs what is missing', async () => {
			const { toolchain, dependencies, platform } = await compiler.resolve({ platformId: 12, platformName: 'argon' });
			expect(toolchain.version).to.equal('6.4.1');
			expect(platform.name).to.equal('argon');
			expect(dependencies.map(d => d.name)).to.eql(['deviceOS', 'gcc-arm', 'buildtools', 'buildscripts']);
			expect(ui.write).to.have.been.calledWith('Targeting version: 6.4.1');
			expect(installer.ensureInstalled).to.have.been.calledWith(dependencies, { label: 'Local toolchain for Device OS 6.4.1 (argon)' });
		});

		it('rejects a platform the manifest does not know', async () => {
			await expect(compiler.resolve({ platformId: 42, platformName: 'tachyon' }))
				.to.be.rejectedWith('The local toolchain does not support tachyon; use --compiler cloud');
		});

		it('lists valid versions for a bad --target', async () => {
			await expect(compiler.resolve({ version: '1.0.0', platformId: 12, platformName: 'argon' }))
				.to.be.rejectedWith('Valid targets for argon:');
		});
	});

	describe('buildExecOptions', () => {
		it('builds the make command and the environment the Makefile documents', () => {
			const { command, args, options } = compiler.buildExecOptions({
				dependencies: argonDeps(),
				platform: { id: 12, name: 'argon' },
				projectDir,
				cliPath: '/opt/particle/bin/particle',
				target: 'compile-user',
				assetOtaDir: 'assets',
				verbose: false
			});
			const scripts = path.join(toolchainDir, 'buildscripts', '1.17.2');
			expect(command).to.equal('make');
			expect(args).to.eql(['-f', `'${path.join(scripts, 'Makefile')}'`, 'compile-user', '-s']);
			expect(options.cwd).to.equal(projectDir);
			expect(options.shell).to.equal('/bin/bash');
			const { env } = options;
			expect(env.PLATFORM).to.equal('argon');
			expect(env.PLATFORM_ID).to.equal('12');
			expect(env.APPDIR).to.equal(projectDir);
			expect(env.DEVICE_OS_PATH).to.equal(path.join(toolchainDir, 'deviceOS', '6.4.1'));
			expect(env.DEVICE_OS_VERSION).to.equal('6.4.1');
			expect(env.GCC_ARM_PATH).to.equal(path.join(toolchainDir, 'gcc-arm', '10.2.1', 'bin') + path.sep);
			expect(env.PARTICLE_CLI_PATH).to.equal('/opt/particle/bin/particle');
			expect(env.PARTICLE_LOCAL_COMPILER_DEBUG).to.equal('0');
			expect(env.ASSET_OTA_DIR).to.equal('assets');
			expect(env.PKG_EXECPATH).to.equal('');
			expect(env.EXTRA_CFLAGS).to.equal('');
			expect(env.PARTICLE_DEVICE_ID).to.equal('');
			const pathKey = Object.keys(env).find(k => k.toUpperCase() === 'PATH');
			const dirs = env[pathKey].split(path.delimiter);
			expect(dirs.slice(0, 3)).to.eql([
				path.join(toolchainDir, 'gcc-arm', '10.2.1', 'bin'),
				path.join(toolchainDir, 'buildtools', '1.1.1'),
				'/opt/particle/bin'
			]);
			expect(dirs.length).to.be.greaterThan(3); // the user's PATH follows
		});

		it('drops -s and turns Makefile debugging on when verbose', () => {
			const { args, options } = compiler.buildExecOptions({
				dependencies: argonDeps(), platform: { id: 12, name: 'argon' }, projectDir,
				cliPath: '/opt/particle/bin/particle', target: 'compile-user', verbose: true
			});
			expect(args).to.not.include('-s');
			expect(options.env.PARTICLE_LOCAL_COMPILER_DEBUG).to.equal('1');
			expect(options.env).to.not.have.property('ASSET_OTA_DIR');
		});

		it('uses buildtools bash and forward slashes on Windows', () => {
			const windows = new LocalCompiler({
				ui, installer, exec, fetchManifest: async () => manifest, host: { platform: 'win32', arch: 'x64' }
			});
			const deps = manifest.dependenciesFor(manifest.toolchainForVersion('6.4.1'), { os: 'windows', arch: 'x64' });
			const { args, options } = windows.buildExecOptions({
				dependencies: deps, platform: { id: 12, name: 'argon' }, projectDir: 'C:\\Users\\me\\blinky',
				cliPath: 'C:\\particle\\bin\\particle.exe', target: 'compile-user', verbose: false
			});
			expect(options.shell).to.equal(path.join(toolchainDir, 'buildtools', '1.1.1', 'bin', 'bash.exe'));
			expect(options.env.APPDIR).to.equal('C:/Users/me/blinky');
			expect(options.env.PARTICLE_CLI_PATH).to.equal('C:/particle/bin/particle.exe');
			expect(args[1]).to.not.include('\\');
			const pathKey = Object.keys(options.env).find(k => k.toUpperCase() === 'PATH');
			expect(options.env[pathKey]).to.include(path.join(toolchainDir, 'buildtools', '1.1.1', 'bin'));
		});
	});

	describe('compile', () => {
		it('rejects unknown build targets', async () => {
			await expect(compiler.compile({ projectDir, platformId: 12, platformName: 'argon', target: 'flash-user' }))
				.to.be.rejectedWith(`Unknown build target flash-user; expected one of ${BUILD_TARGETS.join(', ')}`);
			expect(exec).to.not.have.been.called;
		});

		it('rejects project paths with whitespace', async () => {
			await expect(compiler.compile({ projectDir: '/tmp/my project', platformId: 12, platformName: 'argon' }))
				.to.be.rejectedWith('Local compile does not support project paths with whitespace: /tmp/my project');
			expect(exec).to.not.have.been.called;
		});

		it('runs make in the project directory and returns the binary the Makefile wrote', async () => {
			exec.callsFake(fakeMake({
				exitCode: 0,
				onRun: async ({ options }) => {
					expect(options.cwd).to.equal(projectDir);
					await fs.outputFile(path.join(projectDir, 'target', '6.4.1', 'argon', 'blinky.bin'), 'bin');
				}
			}));
			const result = await compiler.compile({ projectDir, platformId: 12, platformName: 'argon' });
			expect(result).to.eql({
				filename: path.join(projectDir, 'target', '6.4.1', 'argon', 'blinky.bin'),
				isBundle: false,
				version: '6.4.1',
				targetDir: path.join(projectDir, 'target', '6.4.1', 'argon')
			});
			expect(exec).to.have.been.calledOnce;
			expect(exec.firstCall.args[2]).to.include({ reject: false, stdin: 'ignore' });
		});

		it('prefers the bundle when the Makefile produced one', async () => {
			exec.callsFake(fakeMake({
				exitCode: 0,
				onRun: () => fs.outputFile(path.join(projectDir, 'target', '6.4.1', 'argon', 'blinky.zip'), 'zip')
			}));
			const result = await compiler.compile({ projectDir, platformId: 12, platformName: 'argon' });
			expect(result.isBundle).to.equal(true);
			expect(result.filename).to.match(/blinky\.zip$/);
		});

		it('fails with the make exit code', async () => {
			exec.callsFake(fakeMake({ exitCode: 2 }));
			await expect(compiler.compile({ projectDir, platformId: 12, platformName: 'argon' }))
				.to.be.rejectedWith('make exited with code 2');
		});

		it('fails when make succeeded but left no artifact', async () => {
			await expect(compiler.compile({ projectDir, platformId: 12, platformName: 'argon' }))
				.to.be.rejectedWith(`make finished but no blinky.bin or blinky.zip was found in ${path.join(projectDir, 'target', '6.4.1', 'argon')}`);
		});
	});

	describe('cliExecutable', () => {
		it('writes a script that runs this checkout with this node when not packaged', async () => {
			compiler.cliExecutable.restore();
			const wrapper = await compiler.cliExecutable();
			const script = await fs.readFile(wrapper, 'utf8');
			expect(path.basename(wrapper)).to.equal('particle');
			expect(script).to.include(process.execPath.replace(/\\/g, '/'));
			expect(script).to.include(path.resolve(__dirname, '..', '..', 'index.js').replace(/\\/g, '/'));
			expect((await fs.stat(wrapper)).mode & 0o111).to.not.equal(0);
			expect(await compiler.cliExecutable()).to.equal(wrapper);
		});

		it('is the packaged binary itself under pkg', async () => {
			compiler.cliExecutable.restore();
			process.pkg = {};
			try {
				expect(await compiler.cliExecutable()).to.equal(process.execPath);
			} finally {
				delete process.pkg;
			}
		});
	});
});
