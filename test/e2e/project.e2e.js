const path = require('path');
const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	PATH_TMP_DIR,
	PATH_PARTICLE_PROJECTS_DIR
} = require('../lib/env');


describe('Project Commands', () => {
	const projName = 'test-proj';
	const globalProjPath = path.join(PATH_PARTICLE_PROJECTS_DIR, projName);
	const localProjPath = path.join(PATH_TMP_DIR, projName);
	const help = [
		'Manage application projects',
		'Usage: particle project <command>',
		'Help:  particle help project <command>',
		'',
		'Commands:',
		'  create  Create a new project in the current or specified directory',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	afterEach(async () => {
		await fs.emptyDir(PATH_PARTICLE_PROJECTS_DIR);
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'project']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('project');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['project', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Creates a project', async () => {
		const args = ['project', 'create', PATH_TMP_DIR];
		const subprocess = cli.run(args);

		await delay(1000);
		subprocess.stdin.write(projName);
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(await fs.exists(localProjPath)).to.equal(true);
		expect(stdout).to.include(`Initializing project in directory ${localProjPath}...`);
		expect(stdout).to.include(`A new project has been initialized in directory ${localProjPath}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const contents = await fs.getDirectoryContents(localProjPath, { maxDepth: 2 });
		const stripRoot = (x) => x.replace(localProjPath + path.sep, '');

		expect(contents.map(stripRoot)).to.eql([
			'README.md',
			'project.properties',
			'src',
			'src/test-proj.ino'
		]);
	});

	it('Creates a project in the default location', async () => {
		const args = ['project', 'create'];
		const subprocess = cli.run(args);

		await delay(1000);
		subprocess.stdin.write(projName);
		subprocess.stdin.write('\n');
		await delay(1000);
		subprocess.stdin.write('y');
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(await fs.exists(globalProjPath)).to.equal(true);
		expect(stdout).to.include(`Initializing project in directory ${globalProjPath}...`);
		expect(stdout).to.include(`A new project has been initialized in directory ${globalProjPath}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const contents = await fs.getDirectoryContents(globalProjPath, { maxDepth: 2 });
		const stripRoot = (x) => x.replace(globalProjPath + path.sep, '');

		expect(contents.map(stripRoot)).to.eql([
			'README.md',
			'project.properties',
			'src',
			'src/test-proj.ino'
		]);
	});

	it('Creates a project using the `--name` flag', async () => {
		const args = ['project', 'create', '--name', projName, PATH_TMP_DIR];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(await fs.exists(localProjPath)).to.equal(true);
		expect(stdout).to.include(`Initializing project in directory ${localProjPath}...`);
		expect(stdout).to.include(`A new project has been initialized in directory ${localProjPath}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const contents = await fs.getDirectoryContents(localProjPath, { maxDepth: 2 });
		const stripRoot = (x) => x.replace(localProjPath + path.sep, '');

		expect(contents.map(stripRoot)).to.eql([
			'README.md',
			'project.properties',
			'src',
			'src/test-proj.ino'
		]);
	});
});

