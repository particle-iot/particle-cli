const path = require('path');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	PATH_TMP_DIR,
	PATH_PROJ_STROBY_INO,
	PATH_FIXTURES_PROJECTS_DIR,
	PATH_FIXTURES_LIBRARIES_DIR, PATH_FIXTURES_THIRDPARTY_OTA_DIR
} = require('../lib/env');
const { unpackApplicationAndAssetBundle } = require('binary-version-reader');


describe('Compile Commands', () => {
	const strobyBinPath = path.join(PATH_TMP_DIR, 'photon-stroby-updated.bin');
	const minBinSize = 3500;
	const help = [
		'Compile a source file, or directory using the cloud compiler',
		'Usage: particle compile [options] <deviceType> [files...]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --target          The firmware version to compile against. Defaults to latest version, or version on device for cellular.  [string]',
		'  --followSymlinks  Follow symlinks when collecting files  [boolean]',
		'  --saveTo          Filename for the compiled binary  [string]',
		'',
		'Examples:',
		'  particle compile photon                                  Compile the source code in the current directory in the cloud for a `photon`',
		'  particle compile electron project --saveTo electron.bin  Compile the source code in the project directory in the cloud for an `electron` and save it to a file named `electron.bin`',
		'',
		'Param deviceType can be: core, c, photon, p, p1, electron, e, argon, a, boron, b, xenon, x, esomx, bsom, b5som, tracker, assettracker, trackerm, p2, photon2, msom, muon, electron2, tachyon',
	];

	beforeEach(async () => {
		await cli.setTestProfileAndLogin();
	});

	afterEach(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'compile']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('compile');

		expect(stdout).to.equal('Parameter \'deviceType\' is required.');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(1);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['compile', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project', async () => {
		const args = ['compile', 'argon', PATH_PROJ_STROBY_INO, '--saveTo', strobyBinPath];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args);
		const file = await fs.stat(strobyBinPath);
		const log = [
			'Compiling code for argon',
			'',
			'Including:',
			`    ${PATH_PROJ_STROBY_INO}`,
			'', // don't assert against binary info since it's always unique: e.g. 'downloading binary from: /v1/binaries/5d38f108bc91fb000130a3f9'
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${strobyBinPath}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project using the `--target` flag', async () => {
		const args = ['compile', 'argon', PATH_PROJ_STROBY_INO, '--saveTo', strobyBinPath, '--target', '1.4.4'];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args);
		const file = await fs.stat(strobyBinPath);
		const log = [
			'Compiling code for argon',
			'Targeting version: 1.4.4',
			'',
			'Including:',
			`    ${PATH_PROJ_STROBY_INO}`,
			'', // don't assert against binary info since it's always unique: e.g. 'downloading binary from: /v1/binaries/5d38f108bc91fb000130a3f9'
			'Memory use:',
			'    Flash      RAM',
			'     8712     1244',
			'',
			'Compile succeeded.',
			`Saved firmware to: ${strobyBinPath}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a legacy flat project', async () => {
		const name = 'legacy-flat';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, name);
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    app.ino',
			'    helper.cpp',
			'    helper.h',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project which uses `particle.include` file', async () => {
		const name = 'proj-include';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, name);
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, cwd, '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    lib/helper/src/helper.cpp',
			'    lib/helper/src/helper.def',
			'    lib/helper/src/helper.h',
			'    project.properties',
			'    src/app.ino',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project which uses `particle.ignore` file', async () => {
		const name = 'proj-ignore';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, name);
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, cwd, '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    lib/helper/src/helper.cpp',
			'    lib/helper/src/helper.h',
			'    project.properties',
			'    src/app.ino',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a legacy project which uses `particle.ignore` file', async () => {
		const name = 'legacy-exclude';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, name);
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    app.ino',
			'    helper.cpp',
			'    helper.h',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stdout).to.not.include('nope.cpp');
		expect(stdout).to.not.include('nope.h');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project using the `*` wildcard', async () => {
		const name = 'wildcard';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'legacy-flat');
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, '*', '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd, shell: true });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    app.ino',
			'    helper.cpp',
			'    helper.h',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project with multiple header file extensions', async () => {
		const name = 'multiheaders';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'multiple-header-extensions');
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    project.properties',
			'    src/app.ino',
			'    src/helper/h0.cpp',
			'    src/helper/h0.h',
			'    src/helper/h1.cpp',
			'    src/helper/h1.hpp',
			'    src/helper/h2.cpp',
			'    src/helper/h2.hxx',
			'    src/helper/h3.cpp',
			'    src/helper/h3.hh',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project with symlinks to parent/other file locations', async () => {
		const name = 'symlinks';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'symlink', 'main-project');
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, '--saveTo', destination, '--followSymlinks'];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'Including:',
			'    app.ino',
			'    project.properties',
			'    shared/sub_dir/helper.h',
			'    shared/sub_dir/helper.cpp',
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project using its directory name', async () => {
		const name = 'dirname';
		const platform = 'photon';
		const cwd = PATH_FIXTURES_PROJECTS_DIR;
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, 'legacy-flat', '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    legacy-flat/app.ino',
			'    legacy-flat/helper.cpp',
			'    legacy-flat/helper.h',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles an `extended` project', async () => {
		const name = 'extended';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, name);
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, '.', '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    src/app.ino',
			'    src/helper/helper.cpp',
			'    src/helper/helper.h',
			'    project.properties',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a library example', async () => {
		const name = 'library-example';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_LIBRARIES_DIR, 'valid', '0.0.2');
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, 'examples/blink-an-led', '--saveTo', destination];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destination);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    examples/blink-an-led/blink-an-led.cpp',
			'    library.properties',
			'    src/a-c-example.c',
			'    src/test-library-publish.cpp',
			'    src/test-library-publish.h',
			'    src/uber-library-example/uber-library-example.h',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project for the `core` platform', async () => {
		const args = ['compile', 'core', PATH_PROJ_STROBY_INO, '--saveTo', strobyBinPath];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args);
		const file = await fs.stat(strobyBinPath);
		const log = [
			'Compiling code for core',
			'',
			'Including:',
			`    ${PATH_PROJ_STROBY_INO}`,
			'', // don't assert against binary info since it's always unique: e.g. 'downloading binary from: /v1/binaries/5d38f108bc91fb000130a3f9'
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${strobyBinPath}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
	it('Fails to compile when platform is unrecognized', async () => {
		const platform = 'WATNOPE';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR);
		const args = ['compile', platform, 'WATNOPE'];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			'Compile failed: Target device WATNOPE is not valid',
			'	eg. particle compile boron xxx',
			'	eg. particle compile p2 xxx'
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('Fails to compile when file cannot be found', async () => {
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR);
		const args = ['compile', platform, 'WATNOPE'];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'Compile failed: I couldn\'t find that: WATNOPE'
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('Fails to compile when `--saveTo` is not writable', async () => {
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'legacy-flat');
		const destination = path.join(PATH_TMP_DIR, 'WAT', 'NOPE', 'no.bin');
		const args = ['compile', platform, '--saveTo', destination];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    app.ino',
			'    helper.cpp',
			'    helper.h',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`Compile failed: ENOENT: no such file or directory, open '${destination}'`
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('Fails to compile invalid code', async () => {
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'fail');
		const args = ['compile', platform, '.'];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });

		expect(stdout).to.include('Compiling code for photon');
		expect(stdout).to.include('Compile failed: make -C ../modules/photon/user-part all');
		expect(stdout).to.include('error: \'asdfjasfjdkl\' does not name a type');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('Fails to compile when user is signed-out', async () => {
		await cli.logout();

		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR);
		const args = ['compile', platform, '.'];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });

		expect(stdout).to.include('Compile failed: You\'re not logged in. Please login using particle login before using this command');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('Fails to compile there are no sources to compile', async () => {
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'stroby-no-sources');
		const args = ['compile', platform, '.'];

		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });

		expect(stdout).to.include('Compile failed: No source to compile!');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it ('Creates a bundle with legacy flat project', async () => {
		const platform = 'tracker';
		const cwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'projects', 'stroby-with-assets');
		const destinationZip = path.join(PATH_TMP_DIR, 'bundle.zip');
		const args = ['compile', platform, '--saveTo', destinationZip];
		const { stdout, stderr, exitCode, start, end } = await cliRunWithTimer(args, { cwd });
		const file = await fs.stat(destinationZip);
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    src/stroby.ino',
			'    project.properties',
			'    assets/cat.txt',
			'    assets/house.txt',
			'    assets/water.txt',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded and bundle created.',
			`Saved bundle to: ${destinationZip}`
		];

		expect(file.size).to.be.above(minBinSize);
		expect(file.mtimeMs).to.be.within(start, end);
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		if (await fs.exists(destinationZip)) {
			await fs.unlink(destinationZip);
		}
	});

	it ('verifies bundle', async () => {
		const platform = 'tracker';
		const cwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'projects', 'stroby-with-assets');
		const destination = path.join(PATH_TMP_DIR, 'bundle.zip');
		const args = ['compile', platform, '--saveTo', destination];
		let assetNames = [];

		await cliRunWithTimer(args, { cwd });
		const unpacked = await unpackApplicationAndAssetBundle(destination);
		unpacked.assets.forEach((asset) => {
			assetNames.push(asset.name);
		});

		expect(unpacked).to.have.keys('application', 'assets');
		expect(assetNames).to.include.members(['cat.txt', 'house.txt', 'water.txt']);
		expect(unpacked.application.name).to.equal('bundle.bin');

		if (await fs.exists(destination)) {
			await fs.unlink(destination);
		}
	});

	it ('Creates a bundle with legacy flat project with default name', async () => {
		const platform = 'tracker';
		const cwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'projects', 'stroby-with-assets');
		const args = ['compile', platform];
		const { stdout, stderr, exitCode } = await cliRunWithTimer(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    project.properties',
			'    src/stroby.ino',
			'    assets/cat.txt',
			'    assets/house.txt',
			'    assets/water.txt',
			'',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Memory use:',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded and bundle created.',
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stdout).to.match(/[\s\S]*tracker_firmware_\d+.zip/);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const files = await fs.readdir(cwd);
		const defaultName = stdout.match(/tracker_firmware_\d+.zip/)[0];
		const defaultNameExists = files.includes(defaultName);
		if (defaultNameExists) {
			await fs.unlink(path.join(cwd, defaultName));
		}
	});

	it ('checks that the .bin file does not exist outside of the bundle', async () => {
		const platform = 'tracker';
		const cwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'projects', 'stroby-with-assets');
		const args = ['compile', platform];
		await cliRunWithTimer(args, { cwd });
		const files = await fs.readdir(cwd);

		files.forEach( async (file) => {
			if (file.match(/tracker_firmware_\d+.bin/)) {
				expect(false).to.be.true;
			}
			if (file.match(/tracker_firmware_\d+.zip/)) {
				await fs.unlink(path.join(cwd, file));
			}
		});
	});

	async function cliRunWithTimer(...args){
		const start = Date.now();
		const { stdout, stderr, exitCode } = await cli.run(...args);
		const end = Date.now();
		return { stdout, stderr, exitCode, start, end };
	}
});

