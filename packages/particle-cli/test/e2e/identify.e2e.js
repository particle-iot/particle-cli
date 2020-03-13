const { expect } = require('../setup');
const { runForAtLeast } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID
} = require('../lib/env');


describe('Identify Commands [@device]', () => {
	const help = [
		'Ask for and display device ID via serial',
		'Usage: particle identify [options]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --port  Use this serial port instead of auto-detecting. Useful if there are more than 1 connected device  [string]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
		await cli.startListeningMode();
	});

	after(runForAtLeast(15, async () => {
		await cli.stopListeningMode();
		await cli.logout();
		await cli.setDefaultProfile();
	}));

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'identify']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['identify', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Identifies device', async () => {
		const { stdout, stderr, exitCode } = await cli.run('identify');

		expect(stdout).to.include(`Your device id is ${DEVICE_ID}`);
		expect(stdout).to.include('Your system firmware version is');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

