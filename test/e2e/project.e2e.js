const path = require('path');
const { expect } = require('../test-setup');
const { delay } = require('../__lib__/mocha-utils');
const cli = require('../__lib__/cli');
const fs = require('../__lib__/fs');
const {
	PATH_TMP_DIR
} = require('../__lib__/env');


describe('Project Commands', () => {
	const projName = 'test-proj';
	const projPath = path.join(PATH_TMP_DIR, projName);
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

	beforeEach(async () => {
		await fs.emptyDir(PATH_TMP_DIR);
	});

	after(async () => {
		await fs.emptyDir(PATH_TMP_DIR);
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

		expect(await fs.exists(projPath)).to.equal(true);
		expect(stdout).to.include(`Initializing project in directory ${projPath}...`);
		expect(stdout).to.include(`A new project has been initialized in directory ${projPath}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const contents = await fs.getDirectoryContents(projPath, { maxDepth: 2 });
		const stripRoot = (x) => x.replace(projPath + path.sep, '');

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

		expect(await fs.exists(projPath)).to.equal(true);
		expect(stdout).to.include(`Initializing project in directory ${projPath}...`);
		expect(stdout).to.include(`A new project has been initialized in directory ${projPath}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const contents = await fs.getDirectoryContents(projPath, { maxDepth: 2 });
		const stripRoot = (x) => x.replace(projPath + path.sep, '');

		expect(contents.map(stripRoot)).to.eql([
			'README.md',
			'project.properties',
			'src',
			'src/test-proj.ino'
		]);
	});
});
