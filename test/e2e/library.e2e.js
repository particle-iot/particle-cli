const path = require('path');
const semver = require('semver');
const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const matches = require('../lib/capture-matches');
const stripANSI = require('../lib/ansi-strip');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	PATH_TMP_DIR,
	PATH_FIXTURES_LIBRARIES_DIR,
	PATH_PARTICLE_LIBRARIES_DIR
} = require('../lib/env');


describe('Library Commands', () => {
	const projName = 'test-proj';
	const projPath = path.join(PATH_TMP_DIR, projName);
	const libCreateLog = [
		'   create library.properties',
		'   create README.md',
		'   create LICENSE',
		'   create src/testlib.cpp',
		'   create src/testlib.h',
		'   create examples/usage/usage.ino'
	];
	const help = [
		'Manage firmware libraries',
		'Usage: particle library <command>',
		'Help:  particle help library <command>',
		'',
		'Commands:',
		'  add      Add a library to the current project.',
		'  create   Create a new library in the specified or current directory',
		'  copy     Copy a library to the current project',
		'  list     List libraries available',
		'  migrate  Migrate a local library from v1 to v2 format',
		'  search   Search available libraries',
		'  upload   Uploads a private version of a library.',
		'  publish  Publish a private library, making it public',
		'  view     View details about a library',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	beforeEach(async () => {
		await cli.run(['project', 'create', '--name', projName, PATH_TMP_DIR], { reject: true });
	});

	afterEach(async () => {
		await fs.emptyDir(PATH_PARTICLE_LIBRARIES_DIR);
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
		await fs.emptyDir(PATH_TMP_DIR);
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'library']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('library');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['library', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('Search Subcommand', () => {
		after(async () => {
			await cli.setTestProfileAndLogin();
		});

		it('Searches for a library by name', async () => {
			const args = ['library', 'search', 'dotstar'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.match(/Found \d* libraries matching dot/);
			expect(stdout).to.match(/dotstar \d+\.\d+\.\d+ \d+ An Implementation of Adafruit's DotStar Library for Particle devices/);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Searches for a library using substring match', async () => {
			const args = ['library', 'search', 'dot'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.match(/Found \d* libraries matching dot/);
			expect(stdout).to.match(/dotstar \d+\.\d+\.\d+ \d+ An Implementation of Adafruit's DotStar Library for Particle devices/);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Searches for a library that does not exist', async () => {
			const args = ['library', 'search', 'WATNOPEWATWATNOPENOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('Found 0 libraries matching WATNOPEWATWATNOPENOPE');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails when user is signed-out', async () => {
			await cli.logout();

			const opts = { cwd: projPath };
			const args = ['library', 'search', 'dotstar'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);

			// TODO (mirande): this is a bug - we shouldn't show raw http errors
			expect(stdout).to.include('HTTP error 400');
			expect(stdout).to.include('The access token was not found');
			expect(stderr).to.include('statusCode: 400');
			expect(stderr).to.include('at IncomingMessage.emit');
			expect(exitCode).to.equal(1);
		});
	});

	describe('View Subcommand', () => {
		it('Views library', async () => {
			const name = 'dotstar';
			const args = ['library', 'view', name];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const [version] = matches(stdout, /Library dotstar (.*) installed./g);
			const libPath = path.join(PATH_PARTICLE_LIBRARIES_DIR, `${name}@${version}`);
			const localLibPath = path.join(projPath, 'lib');

			expect(!!semver.valid(version)).to.equal(true);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(await fs.pathExists(libPath)).to.equal(true);
			expect(await fs.pathExists(localLibPath)).to.equal(false);
		});

		it('Fails when attempting to view an unknown library', async () => {
			const opts = { cwd: projPath };
			const args = ['library', 'view', 'WATNOPEWATWATNOPENOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);

			expect(stdout).to.include('Library WATNOPEWATWATNOPENOPE not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('List Subcommand', () => {
		it('Lists libraries', async () => {
			const args = ['library', 'list'];
			const subprocess = cli.run(args);

			await delay(1000);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.cancel(); // CTRL-C

			const { all, isCanceled } = await subprocess;
			const lines = stripANSI(all).trim().split('\n');

			expect(lines).to.have.lengthOf(23);
			expect(lines[0]).to.equal('Community Libraries');
			// TODO (mirande): figure out why this is one line (due to spinner ui)?
			expect(lines[11]).to.equal('Press ENTER for next page, CTRL-C to exit.Community Libraries page 2');
			expect(lines[22]).to.equal('Press ENTER for next page, CTRL-C to exit.');
			expect(isCanceled).to.equal(true);
		});

		it('Lists libraries using `--limit` flag', async () => {
			const args = ['library', 'list', '--limit', 20];
			const subprocess = cli.run(args);

			await delay(1000);
			subprocess.stdin.write(' ');
			await delay(1000);
			subprocess.cancel(); // CTRL-C

			const { all, isCanceled } = await subprocess;
			const lines = stripANSI(all).trim().split('\n');

			expect(lines).to.have.lengthOf(22);
			expect(lines[0]).to.equal('Community Libraries');
			expect(lines[21]).to.equal('Press ENTER for next page, CTRL-C to exit.');
			expect(isCanceled).to.equal(true);
		});

		it('Lists libraries using `--non-interactive` flag', async () => {
			const args = ['library', 'list', '--non-interactive'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const lines = stripANSI(stdout).trim().split('\n');

			expect(lines).to.have.lengthOf(11);
			expect(lines[0]).to.equal('Community Libraries');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});

	describe('Add Subcommand', () => {
		const libDirPath = path.join(PATH_TMP_DIR, 'lib-valid');

		beforeEach(async () => {
			await fs.copy(
				path.join(PATH_FIXTURES_LIBRARIES_DIR, 'valid', '0.0.2'),
				libDirPath
			);
		});

		after(async () => {
			await cli.setTestProfileAndLogin();
		});

		it('Adds a library to a project', async () => {
			const libPath = path.join(projPath, 'lib');

			expect(await fs.pathExists(libPath)).to.equal(false);

			const opts = { cwd: projPath };
			const args = ['library', 'add', 'dotstar'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);
			const [version] = matches(stdout, /Library dotstar (.*) has been added to the project./g);
			const projPropsPath = path.join(projPath, 'project.properties');

			expect(!!semver.valid(version)).to.equal(true);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			const projProps = await fs.readFile(projPropsPath, 'utf8');

			expect(projProps).to.equal(`name=test-proj\ndependencies.dotstar=${version}\n`);
			expect(await fs.pathExists(libPath)).to.equal(false);
		});

		it('Adds a library at a specific version to a project', async () => {
			const libPath = path.join(projPath, 'lib');

			expect(await fs.pathExists(libPath)).to.equal(false);

			const version = '0.0.3';
			const opts = { cwd: projPath };
			const args = ['library', 'add', `dotstar@${version}`];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);
			const projPropsPath = path.join(projPath, 'project.properties');

			expect(stdout).to.include(`Library dotstar ${version} has been added to the project.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			const projProps = await fs.readFile(projPropsPath, 'utf8');

			expect(projProps).to.equal(`name=test-proj\ndependencies.dotstar=${version}\n`);
			expect(await fs.pathExists(libPath)).to.equal(false);
		});

		it('Adds a library to a library project', async () => {
			const libPath = path.join(libDirPath, 'lib');

			expect(await fs.pathExists(libPath)).to.equal(false);

			const opts = { cwd: libDirPath };
			const args = ['library', 'add', 'dotstar'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);
			const [version] = matches(stdout, /Library dotstar (.*) has been added to the project./g);
			const libPropsPath = path.join(libDirPath, 'library.properties');

			expect(stdout).to.include(`Library dotstar ${version} has been added to the project.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			const libProps = await fs.readFile(libPropsPath, 'utf8');
			const expectedLibProps = [
				'name=test-library-publish',
				'version=0.0.2',
				'license=MIT',
				'author=Joe Goggins <joe@particle.io>',
				'sentence=A simple library that illustrates coding conventions of a Spark Library',
				`dependencies.dotstar=${version}`
			];

			expect(libProps).to.equal(`${expectedLibProps.join('\n')}\n`);
			expect(await fs.pathExists(libPath)).to.equal(false);
		});

		it('Fails when attempting to add an unknown library', async () => {
			const opts = { cwd: projPath };
			const args = ['library', 'add', 'WATNOPEWATWATNOPENOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);

			expect(stdout).to.include('Library WATNOPEWATWATNOPENOPE not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails when attempting to add a library to a non-project', async () => {
			const cwd = PATH_TMP_DIR;
			const args = ['library', 'add', 'dotstar'];
			const { stdout, stderr, exitCode } = await cli.run(args, { cwd });

			expect(stdout).to.include(`Project or library not found in directory ${cwd}`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails when user is signed-out', async () => {
			await cli.logout();

			const opts = { cwd: projPath };
			const args = ['library', 'add', 'dotstar'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);

			// TODO (mirande): this is a bug - we shouldn't show raw http errors
			expect(stdout).to.include('HTTP error 400');
			expect(stdout).to.include('The access token was not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Copy Subcommand', () => {
		it('Copies a library to a project', async () => {
			const opts = { cwd: projPath };
			const args = ['library', 'copy', 'dotstar'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);
			const [version] = matches(stdout, /Library dotstar (.*) installed./g);
			const projPropsPath = path.join(projPath, 'project.properties');
			const libPath = path.join(projPath, 'lib');

			expect(!!semver.valid(version)).to.equal(true);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			const projProps = await fs.readFile(projPropsPath, 'utf8');
			const contents = await fs.getDirectoryContents(libPath, { maxDepth: 2 });
			const stripRoot = (x) => x.replace(projPath + path.sep, '');

			expect(projProps).to.equal('name=test-proj\n');
			expect(contents.map(stripRoot)).to.include.members([
				'lib/dotstar/library.properties',
				'lib/dotstar/src/dotstar.cpp',
				'lib/dotstar/src/dotstar.h'
			]);
		});

		it('Copies a library at a specific version to a project', async () => {
			const version = '0.0.3';
			const opts = { cwd: projPath };
			const args = ['library', 'copy', `dotstar@${version}`];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);
			const libPath = path.join(projPath, 'lib');

			expect(stdout).to.include(`Library dotstar ${version} installed.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			const projPropsPath = path.join(projPath, 'project.properties');
			const projProps = await fs.readFile(projPropsPath, 'utf8');
			const contents = await fs.getDirectoryContents(libPath, { maxDepth: 2 });
			const stripRoot = (x) => x.replace(projPath + path.sep, '');

			expect(projProps).to.equal('name=test-proj\n');
			expect(contents.map(stripRoot)).to.eql([
				'lib/dotstar',
				'lib/dotstar/LICENSE',
				'lib/dotstar/README.md',
				'lib/dotstar/examples',
				'lib/dotstar/examples/1-strandtest',
				'lib/dotstar/library.properties',
				'lib/dotstar/src',
				'lib/dotstar/src/dotstar',
				'lib/dotstar/src/dotstar.cpp',
				'lib/dotstar/src/dotstar.h'
			]);
		});

		it('Fails to copy an unknown library to a project', async () => {
			const opts = { cwd: projPath };
			const args = ['library', 'copy', 'WATNOPEWATWATNOPENOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);

			expect(stdout).to.include('Library WATNOPEWATWATNOPENOPE not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Install Subcommand', () => {
		it('Installs a library to a project', async () => {
			const name = 'dotstar';
			const opts = { cwd: projPath };
			const args = ['library', 'install', name];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);
			const [version] = matches(stdout, /Library dotstar (.*) installed./g);
			const libPath = path.join(PATH_PARTICLE_LIBRARIES_DIR, `${name}@${version}`);
			const localLibPath = path.join(projPath, 'lib');

			expect(!!semver.valid(version)).to.equal(true);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(await fs.pathExists(libPath)).to.equal(true);
			expect(await fs.pathExists(localLibPath)).to.equal(false);

			const projPropsPath = path.join(projPath, 'project.properties');
			const projProps = await fs.readFile(projPropsPath, 'utf8');

			expect(projProps).to.equal('name=test-proj\n');
		});

		it('Installs a library to a project using the `--copy` flag', async () => {
			const name = 'dotstar';
			const opts = { cwd: projPath };
			const args = ['library', 'install', name, '--copy'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);
			const [version] = matches(stdout, /Library dotstar (.*) installed./g);
			const libPath = path.join(PATH_PARTICLE_LIBRARIES_DIR, `${name}@${version}`);
			const localLibPath = path.join(projPath, 'lib');

			expect(!!semver.valid(version)).to.equal(true);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(await fs.pathExists(libPath)).to.equal(false);
			expect(await fs.pathExists(localLibPath)).to.equal(true);

			const projPropsPath = path.join(projPath, 'project.properties');
			const projProps = await fs.readFile(projPropsPath, 'utf8');
			const contents = await fs.getDirectoryContents(localLibPath, { maxDepth: 2 });
			const stripRoot = (x) => x.replace(projPath + path.sep, '');

			expect(projProps).to.equal('name=test-proj\n');
			expect(contents.map(stripRoot)).to.eql([
				'lib/dotstar',
				'lib/dotstar/.git',
				'lib/dotstar/LICENSE',
				'lib/dotstar/README.md',
				'lib/dotstar/examples',
				'lib/dotstar/examples/1-strandtest',
				'lib/dotstar/library.properties',
				'lib/dotstar/src',
				'lib/dotstar/src/dotstar',
				'lib/dotstar/src/dotstar.cpp',
				'lib/dotstar/src/dotstar.h'
			]);
		});

		it('Installs a project\'s libraries using the `--vendored` flag', async () => {
			const projPropsPath = path.join(projPath, 'project.properties');
			let projProps = await fs.readFile(projPropsPath, 'utf8');

			expect(projProps).to.equal('name=test-proj\n');

			projProps += 'dependencies.dotstar=0.0.5\n';
			projProps += 'dependencies.neopixel=1.0.0\n';

			await fs.writeFile(projPropsPath, projProps, 'utf8');

			const opts = { cwd: projPath };
			const args = ['library', 'install', '--vendored', '-y'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);
			const [dotstarVer] = matches(stdout, /Library dotstar (.*) installed./g);
			const [neopixelVer] = matches(stdout, /Library neopixel (.*) installed./g);
			const dotstarLibPath = path.join(PATH_PARTICLE_LIBRARIES_DIR, `dotstar@${dotstarVer}`);
			const neopixelLibPath = path.join(PATH_PARTICLE_LIBRARIES_DIR, `neopixel@${neopixelVer}`);
			const localLibPath = path.join(projPath, 'lib');

			expect(!!semver.valid(dotstarVer)).to.equal(true);
			expect(!!semver.valid(neopixelVer)).to.equal(true);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(await fs.pathExists(dotstarLibPath)).to.equal(false);
			expect(await fs.pathExists(neopixelLibPath)).to.equal(false);
			expect(await fs.pathExists(localLibPath)).to.equal(true);

			projProps = await fs.readFile(projPropsPath, 'utf8');
			const contents = await fs.getDirectoryContents(localLibPath, { maxDepth: 0 });
			const stripRoot = (x) => x.replace(projPath + path.sep, '');

			expect(projProps).to.equal([
				'name=test-proj',
				'dependencies.dotstar=0.0.5',
				'dependencies.neopixel=1.0.0\n'
			].join('\n'));
			expect(contents.map(stripRoot)).to.eql([
				'lib/dotstar',
				'lib/neopixel'
			]);
		});
	});

	describe('Create Subcommand', () => {
		it('Creates a library', async () => {
			const name = 'testlib';
			const version = '1.0.0';
			const opts = { cwd: PATH_TMP_DIR };
			const args = ['library', 'create'];
			const subprocess = cli.run(args, opts);

			await delay(1000);
			subprocess.stdin.write(name);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.stdin.write(version);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.stdin.write('me@example.com');
			subprocess.stdin.end('\n');

			const { stderr, exitCode } = await subprocess;

			expect(stderr.split('\n')).to.include.members(libCreateLog);
			expect(exitCode).to.equal(0);
			expectLibrary(name, version, PATH_TMP_DIR);
		}).timeout(60 * 1000);

		it('Creates a library using `--name` `--version` and `--author` flags', async () => {
			const name = 'testlib';
			const version = '1.0.0';
			const opts = { cwd: PATH_TMP_DIR };
			const args = ['library', 'create', '--name', name, '--version', version, '--author', 'me@example.com'];
			const { stdout, stderr, exitCode } = await cli.run(args, opts);

			expect(stdout).to.equal('');
			expect(stderr.split('\n')).to.include.members(libCreateLog);
			expect(exitCode).to.equal(0);
			expectLibrary(name, version, PATH_TMP_DIR);
		});

		it('Fails to create a library when `name` is blank', async () => {
			const opts = { cwd: PATH_TMP_DIR };
			const args = ['library', 'create'];
			const subprocess = cli.run(args, opts);

			await delay(1000);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.cancel(); // CTRL-C

			const { all, isCanceled } = await subprocess;

			expect(all).to.include('name: can\'t be blank');
			expect(isCanceled).to.equal(true);
		});

		it('Fails to create a library when `name` uses prohibited characters', async () => {
			const opts = { cwd: PATH_TMP_DIR };
			const args = ['library', 'create'];
			const subprocess = cli.run(args, opts);

			await delay(1000);
			subprocess.stdin.write('@#$@%&()');
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.cancel(); // CTRL-C

			const { all, isCanceled } = await subprocess;

			expect(all).to.include('name: must only contain letters, numbers, dashes, underscores and plus signs.');
			expect(isCanceled).to.equal(true);
		});

		it('Fails to create a library when `version` is blank', async () => {
			const name = 'testlib';
			const opts = { cwd: PATH_TMP_DIR };
			const args = ['library', 'create'];
			const subprocess = cli.run(args, opts);

			await delay(1000);
			subprocess.stdin.write(name);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.cancel(); // CTRL-C

			const { all, isCanceled } = await subprocess;

			expect(all).to.include('version: can\'t be blank');
			expect(isCanceled).to.equal(true);
		});

		it('Fails to create a library when `version` is invalid', async () => {
			const name = 'testlib';
			const opts = { cwd: PATH_TMP_DIR };
			const args = ['library', 'create'];
			const subprocess = cli.run(args, opts);

			await delay(1000);
			subprocess.stdin.write(name);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.stdin.write('WATNOPE');
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.cancel(); // CTRL-C

			const { all, isCanceled } = await subprocess;

			expect(all).to.include('version: must be formatted like 1.0.0');
			expect(isCanceled).to.equal(true);
		});

		it('Fails to create a library when `author` is blank', async () => {
			const name = 'testlib';
			const version = '1.0.0';
			const opts = { cwd: PATH_TMP_DIR };
			const args = ['library', 'create'];
			const subprocess = cli.run(args, opts);

			await delay(1000);
			subprocess.stdin.write(name);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.stdin.write(version);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.stdin.write('\n');
			await delay(1000);
			subprocess.cancel(); // CTRL-C

			const { all, isCanceled } = await subprocess;

			expect(all).to.include('author: can\'t be blank');
			expect(isCanceled).to.equal(true);
		});
	});

	describe('Migrate Subcommand', () => {
		const { libraryTestResources } = require('particle-commands');
		const libV1Path = path.join(PATH_TMP_DIR, 'lib-v1');
		const libV2Path = path.join(PATH_TMP_DIR, 'lib-v2');
		const libV2WithAdaptersPath = path.join(PATH_TMP_DIR, 'lib-v2-adapters');
		const adapterHeaderPath = path.join(libV1Path, 'src', 'uber-library-example', 'uber-library-example.h');

		beforeEach(async () => {
			await Promise.all([
				fs.copy(
					path.join(libraryTestResources(), 'library-v1'),
					libV1Path
				),
				await fs.copy(
					path.join(libraryTestResources(), 'library-v2'),
					libV2Path
				),
				await fs.copy(
					path.join(libraryTestResources(), 'library-v2-adapters'),
					libV2WithAdaptersPath
				)
			]);
		});

		after(async () => {
			await cli.setTestProfileAndLogin();
		});

		it('Confirms v1 library can be migrated', async () => {
			const args = ['library', 'migrate', '--test', libV1Path];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal(`Library can be migrated: '${libV1Path}'`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Confirms v1 library in current directory can be migrated', async () => {
			const cwd = libV1Path;
			const args = ['library', 'migrate', '--test'];
			const { stdout, stderr, exitCode } = await cli.run(args, { cwd });

			expect(stdout).to.equal('Library can be migrated');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Confirms v2 library is already migrated', async () => {
			const args = ['library', 'migrate', '--test', libV2Path];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal(`Library already in v2 format: '${libV2Path}'`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Does not attempt to migrate a v2 library', async () => {
			const args = ['library', 'migrate', libV2Path];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal(`Library already in v2 format: '${libV2Path}'`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Migrates a v1 library', async () => {
			const args = ['library', 'migrate', libV1Path];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal(`Library migrated to v2 format: '${libV1Path}'`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(await fs.pathExists(adapterHeaderPath)).to.equal(true);

			const stripRoot = (x) => x.replace(libV1Path, '').replace(libV2WithAdaptersPath, '');
			const libV1Files = await fs.getDirectoryContents(libV1Path, { maxDepth: 3 });
			const libV2Files = await fs.getDirectoryContents(libV2WithAdaptersPath, { maxDepth: 3 });

			expect(libV1Files.map(stripRoot)).to.eql(libV2Files.map(stripRoot));
			expect(libV1Files).to.have.lengthOf.above(10);
		});

		it('Migrates a v1 library using the `--adapter` flag', async () => {
			const args = ['library', 'migrate', libV1Path, '--adapter'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal(`Library migrated to v2 format: '${libV1Path}'`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(await fs.pathExists(adapterHeaderPath)).to.equal(true);

			const stripRoot = (x) => x.replace(libV1Path, '').replace(libV2WithAdaptersPath, '');
			const libV1Files = await fs.getDirectoryContents(libV1Path, { maxDepth: 3 });
			const libV2Files = await fs.getDirectoryContents(libV2WithAdaptersPath, { maxDepth: 3 });

			expect(libV1Files.map(stripRoot)).to.eql(libV2Files.map(stripRoot));
			expect(libV1Files).to.have.lengthOf.above(10);
		});

		it('Migrates a v1 library using the `--no-adapter` flag', async () => {
			const args = ['library', 'migrate', libV1Path, '--no-adapter'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal(`Library migrated to v2 format: '${libV1Path}'`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(await fs.pathExists(adapterHeaderPath)).to.equal(false);

			const stripRoot = (x) => x.replace(libV1Path, '').replace(libV2Path, '');
			const libV1Files = await fs.getDirectoryContents(libV1Path, { maxDepth: 3 });
			const libV2Files = await fs.getDirectoryContents(libV2Path, { maxDepth: 3 });

			expect(libV1Files.map(stripRoot)).to.eql(libV2Files.map(stripRoot));
			expect(libV1Files).to.have.lengthOf.above(10);
		});

		it('Migrates a v1 library only once', async () => {
			const args = ['library', 'migrate', libV1Path];
			const one = await cli.run(args);

			expect(one.stdout).to.equal(`Library migrated to v2 format: '${libV1Path}'`);
			expect(one.stderr).to.equal('');
			expect(one.exitCode).to.equal(0);

			const two = await cli.run(args);

			expect(two.stdout).to.equal(`Library already in v2 format: '${libV1Path}'`);
			expect(two.stderr).to.equal('');
			expect(two.exitCode).to.equal(0);
		});
	});

	async function expectLibrary(name, version, dir){
		const libPropsPath = path.join(dir, 'library.properties');
		const libProps = await fs.readFile(libPropsPath, 'utf8');
		const libFiles = [
			path.join(PATH_TMP_DIR, 'LICENSE'),
			path.join(PATH_TMP_DIR, 'README.md'),
			path.join(PATH_TMP_DIR, 'src', `${name}.h`),
			path.join(PATH_TMP_DIR, 'src', `${name}.cpp`),
			path.join(PATH_TMP_DIR, 'examples', 'usage', 'usage.ino')
		];

		for (let file of libFiles){
			expect(await fs.pathExists(file)).to.equal(true);
		}
		expect(libProps.split('\n')).to.include.members([
			'# Fill in information about your library then remove # from the start of lines',
			'# https://docs.particle.io/guide/tools-and-features/libraries/#library-properties-fields',
			`name=${name}`,
			`version=${version}`,
			'author=me@example.com',
			'# license=insert your choice of license here',
			'# sentence=one sentence description of this library',
			'# paragraph=a longer description of this library, always prepended with sentence when shown',
			'# url=the URL of the project, like https://github.com/mygithub_user/my_repo',
			'# repository=git repository for the project, like https://github.com/mygithub_user/my_repo.git',
			'# architectures=a list of supported boards if this library is hardware dependent, like particle-photon,particle-electron'
		]);
	}
});

