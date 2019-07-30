const path = require('path');
const { expect } = require('../test-setup');
const { delay } = require('../__lib__/mocha-utils');
const matches = require('../__lib__/capture-matches');
const stripANSI = require('../__lib__/ansi-strip');
const cli = require('../__lib__/cli');
const fs = require('../__lib__/fs');
const {
	PATH_TMP_DIR,
	PATH_PARTICLE_LIBRARIES_DIR
} = require('../__lib__/env');


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
		await fs.emptyDir(PATH_TMP_DIR);
		await cli.run(['project', 'create', '--name', projName, PATH_TMP_DIR], { reject: true });
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

	it('Searches for a library', async () => {
		const args = ['library', 'search', 'dot'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.match(/Found \d* libraries matching dot/);
		expect(stdout).to.match(/dotstar \d+\.\d+\.\d+ \d+ An Implementation of Adafruit's DotStar Library for Particle devices/);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Views library', async () => {
		const name = 'dotstar';
		const args = ['library', 'view', name];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const version = matches(stdout, /Library dotstar (.*) installed./g);
		const libPath = path.join(PATH_PARTICLE_LIBRARIES_DIR, `${name}@${version}`);

		expect(version).to.match(/^\d+\.\d+\.\d+$/);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
		expect(await fs.pathExists(libPath)).to.equal(true);
	});

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

	it('Add a library to a project', async () => {
		const opts = { cwd: projPath };
		const args = ['library', 'add', 'dotstar'];
		const { stdout, stderr, exitCode } = await cli.run(args, opts);
		const version = matches(stdout, /Library dotstar (.*) has been added to the project./g);
		const projPropsPath = path.join(projPath, 'project.properties');
		const libPath = path.join(projPath, 'lib');

		expect(version).to.match(/^\d+\.\d+\.\d+$/);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const projProps = await fs.readFile(projPropsPath, 'utf8');

		expect(projProps).to.equal(`name=test-proj\ndependencies.dotstar=${version}\n`);
		expect(await fs.pathExists(libPath)).to.equal(false);
	});

	it('Add a library at a specific version to a project', async () => {
		const version = '0.0.3';
		const opts = { cwd: projPath };
		const args = ['library', 'add', `dotstar@${version}`];
		const { stdout, stderr, exitCode } = await cli.run(args, opts);
		const projPropsPath = path.join(projPath, 'project.properties');
		const libPath = path.join(projPath, 'lib');

		expect(stdout).to.include(`Library dotstar ${version} has been added to the project.`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const projProps = await fs.readFile(projPropsPath, 'utf8');

		expect(projProps).to.equal(`name=test-proj\ndependencies.dotstar=${version}\n`);
		expect(await fs.pathExists(libPath)).to.equal(false);
	});

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
		subprocess.stdin.write('\n');

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

	it('Copies a library to a project', async () => {
		const opts = { cwd: projPath };
		const args = ['library', 'copy', 'dotstar'];
		const { stdout, stderr, exitCode } = await cli.run(args, opts);
		const version = matches(stdout, /Library dotstar (.*) installed./g);
		const projPropsPath = path.join(projPath, 'project.properties');
		const libPath = path.join(projPath, 'lib');

		expect(version).to.match(/^\d+\.\d+\.\d+$/);
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
		const projPropsPath = path.join(projPath, 'project.properties');
		const libPath = path.join(projPath, 'lib');

		expect(stdout).to.include(`Library dotstar ${version} installed.`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

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

