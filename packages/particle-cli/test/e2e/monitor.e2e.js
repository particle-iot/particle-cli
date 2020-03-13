const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID
} = require('../lib/env');


describe('Monitor Commands [@device]', () => {
	const help = [
		'Connect and display messages from a device',
		'Usage: particle monitor [options] [device] [variableName]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --time   Show the time when the variable was received  [boolean]',
		'  --delay  Interval in milliseconds between variable fetches  [number]',
		'',
		'Examples:',
		'  particle monitor up temp --delay 2000  Read the temp variable from the device up every 2 seconds'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
		await cli.flashStrobyFirmwareOTAForTest();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'monitor']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['monitor', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Monitors a variable', async () => {
		const args = ['monitor', DEVICE_ID, 'version'];
		const subprocess = cli.run(args);

		await delay(6000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [msg, ...results] = all.split('\n');

		expect(msg).to.equal('Hit CTRL-C to stop!');
		expect(results).to.have.lengthOf.above(3);
		expect(isCanceled).to.equal(true);
	});

	it('Monitors a variable using the `--delay` flag', async () => {
		const args = ['monitor', DEVICE_ID, 'version', '--delay', 1500];
		const subprocess = cli.run(args);

		await delay(6000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [msg, ...results] = all.split('\n');

		expect(msg).to.equal('Hit CTRL-C to stop!');
		expect(results).to.have.lengthOf.above(1);
		expect(isCanceled).to.equal(true);
	});
});

