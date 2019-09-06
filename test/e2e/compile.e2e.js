const path = require('path');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	PATH_TMP_DIR,
	PATH_PROJ_STROBY_INO,
	PATH_FIXTURES_PROJECTS_DIR,
	PATH_FIXTURES_LIBRARIES_DIR
} = require('../lib/env');


describe('Compile Commands', () => {
	const strobyBinPath = path.join(PATH_TMP_DIR, 'photon-stroby-updated.bin');
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
		'  particle compile photon                                  Compile the source code in the current directory in the cloud for a Photon',
		'  particle compile electron project --saveTo electron.bin  Compile the source code in the project directory in the cloud for a Electron and save it to electron.bin',
		'',
		'Param deviceType can be: core, photon, p1, electron, argon, asom, boron, bsom, xenon, xsom, etc'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
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
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			'Compiling code for argon',
			'',
			'Including:',
			`    ${PATH_PROJ_STROBY_INO}`,
			'attempting to compile firmware ',
			'', // don't assert against binary info since it's always unique: e.g. 'downloading binary from: /v1/binaries/5d38f108bc91fb000130a3f9'
			`saving to: ${strobyBinPath}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${strobyBinPath}`
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a project using the `--target` flag', async () => {
		const args = ['compile', 'argon', PATH_PROJ_STROBY_INO, '--saveTo', strobyBinPath, '--target', '1.2.1'];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			'Compiling code for argon',
			'',
			'Including:',
			`    ${PATH_PROJ_STROBY_INO}`,
			'attempting to compile firmware ',
			'', // don't assert against binary info since it's always unique: e.g. 'downloading binary from: /v1/binaries/5d38f108bc91fb000130a3f9'
			`saving to: ${strobyBinPath}`,
			'Memory use: ',
			'   text\t   data\t    bss\t    dec\t    hex\tfilename',
			'   7900\t    112\t   1084\t   9096\t   2388\t/workspace/target/workspace.elf',
			'',
			'Compile succeeded.',
			`Saved firmware to: ${strobyBinPath}`
		];

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
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    helper.h',
			'    app.ino',
			'    helper.cpp',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a legacy nested project', async () => {
		const name = 'legacy-nested';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, name);
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, '--saveTo', destination];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    helper/helper.h',
			'    app.ino',
			'    helper/helper.cpp',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Compiles a legacy project which uses `particle.include` file', async () => {
		const name = 'legacy-include';
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, name);
		const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
		const args = ['compile', platform, 'main', '--saveTo', destination];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    main/app.ino',
			'    helper/helper.cpp',
			'    helper/helper.h',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

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
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    app.ino',
			'    helper.cpp',
			'    helper.h',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

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
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd, shell: true });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    helper.h',
			'    app.ino',
			'    helper.cpp',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

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
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    project.properties',
			'    src/helper/h0.h',
			'    src/helper/h1.hpp',
			'    src/helper/h3.hh',
			'    src/helper/h2.hxx',
			'    src/app.ino',
			'    src/helper/h0.cpp',
			'    src/helper/h1.cpp',
			'    src/helper/h2.cpp',
			'    src/helper/h3.cpp',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

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
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'Including:',
			'    shared/sub_dir/helper.h',
			'    app.ino',
			'    shared/sub_dir/helper.cpp',
			'    project.properties',
		];

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
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    legacy-flat/helper.h',
			'    legacy-flat/app.ino',
			'    legacy-flat/helper.cpp',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

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
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			`Compiling code for ${platform}`,
			'',
			'Including:',
			'    src/helper/helper.h',
			'    src/app.ino',
			'    src/helper/helper.cpp',
			'    project.properties',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

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
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
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
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`,
			'Memory use: ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			'Compile succeeded.',
			`Saved firmware to: ${destination}`
		];

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
			'	eg. particle compile core xxx',
			'	eg. particle compile photon xxx'
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
			'    helper.h',
			'    app.ino',
			'    helper.cpp',
			'',
			'attempting to compile firmware ',
			'', // don't assert against memory stats since they may change based on current default Device OS version
			`saving to: ${destination}`
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.include(`Error: ENOENT: no such file or directory, open '${destination}'`);
		expect(exitCode).to.equal(1);
	});

	it('Fails to compile invalid code', async () => {
		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'fail');
		const args = ['compile', platform, '.'];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });

		expect(stdout).to.include('Compiling code for photon');
		expect(stdout).to.include('error: \'asdfjasfjdkl\' does not name a type');
		expect(stdout).to.include('Compile failed: Compiler encountered an error');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('Fails to compile when user is signed-out', async () => {
		await cli.logout();

		const platform = 'photon';
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR);
		const args = ['compile', platform, '.'];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });

		expect(stdout).to.include('Compile failed: You\'re not logged in. Please login using particle cloud login before using this command');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});

