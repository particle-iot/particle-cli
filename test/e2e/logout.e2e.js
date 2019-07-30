const { expect } = require('../test-setup');
const { delay } = require('../__lib__/mocha-utils');
const cli = require('../__lib__/cli');
const {
	USERNAME
} = require('../__lib__/env');


describe('Logout Command', () => {
	const help = [
		'Log out of your session and clear your saved access token',
		'Usage: particle logout [options]',
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
		const { stdout, stderr, exitCode } = await cli.run(['help', 'logout']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['logout', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Signs out', async () => {
		const subprocess = cli.run(['logout']);

		await delay(1000);
		subprocess.stdin.write('y');
		subprocess.stdin.write('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(stdout).to.include(`You have been logged out from ${USERNAME}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

