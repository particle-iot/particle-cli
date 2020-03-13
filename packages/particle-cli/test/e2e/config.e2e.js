const path = require('path');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	PATH_PARTICLE_DIR
} = require('../lib/env');


describe('Config Commands', () => {
	const profileName = 'e2e-updated';
	const profilePath = path.join(PATH_PARTICLE_DIR, `${profileName}.config.json`);
	const help = [
		'Configure and switch between multiple accounts',
		'Usage: particle config [options] [profile] [setting] [value]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --list  Display available configurations  [boolean]',
		'',
		'Examples:',
		'  particle config company                           Switch to a profile called company',
		'  particle config particle                          Switch back to the default profile',
		'  particle config set apiUrl http://localhost:9090  Change the apiUrl setting for the current profile'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	afterEach(async () => {
		await fs.remove(profilePath);
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'config']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['config', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Creates new profile', async () => {
		const args = ['config', profileName];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(await fs.pathExists(profilePath)).to.equal(false);

		await cli.login();

		expect(stdout).to.equal('');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
		expect(await fs.pathExists(profilePath)).to.equal(true);
	});

	it('Creates new profile and changes a settings', async () => {
		const args = ['config', profileName, 'apiUrl', 'http://localhost:9090'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal('');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
		expect(await fs.pathExists(profilePath)).to.equal(true);
	});

	it('Lists available configuration profiles', async () => {
		await cli.run(['config', profileName]);
		await cli.login();

		const { stdout, stderr, exitCode } = await cli.run(['config', '--list']);

		expect(stdout).to.include(profileName);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

