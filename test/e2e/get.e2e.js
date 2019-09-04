const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME
} = require('../lib/env');


describe('Get Commands [@device]', () => {
	const help = [
		'Retrieve a value from your device',
		'Usage: particle get [options] [device] [variableName]',
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
		'  particle get basement temperature  Read the temperature variable from the device basement',
		'  particle get all temperature       Read the temperature variable from all my devices'
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
		const { stdout, stderr, exitCode } = await cli.run(['help', 'get']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['get', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Lists all available variables', async () => {
		const { stdout, stderr, exitCode } = await cli.run('get');

		expect(stdout).to.include(`${DEVICE_NAME} (${DEVICE_ID}) has`);
		expect(stdout).to.include('version (int32)');
		expect(stderr).to.include('polling server to see what devices are online, and what variables are available');
		expect(exitCode).to.equal(0);
	});

	it('Lists variables available on device and prompts to pick', async () => {
		const subprocess = cli.run(['get', DEVICE_ID]);

		await delay(1000);
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(stdout).to.include('Which variable did you want? (Use arrow keys)');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Gets a variable by name', async () => {
		const args = ['get', DEVICE_ID, 'version'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal('42');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Gets a variable by name with timestamp', async () => {
		const args = ['get', DEVICE_ID, 'version', '--time'];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const [timestamp, version] = stdout.split(', ');

		expect(timestamp.split(':')).to.have.lengthOf(4);
		expect(version).to.equal('42');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

