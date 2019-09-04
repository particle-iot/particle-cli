const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	USERNAME
} = require('../lib/env');


describe('Whoami Commands', () => {
	const help = [
		'prints signed-in username',
		'Usage: particle whoami [options]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'whoami']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['whoami', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Reports currently signed-in username', async () => {
		const { stdout, stderr, exitCode } = await cli.run('whoami');

		expect(stdout).to.include(USERNAME);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Errors when user is signed-out', async () => {
		await cli.logout();
		const { stdout, stderr, exitCode } = await cli.run('whoami');

		expect(stdout).to.equal('You are not signed in! Please run: `particle login`');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});

