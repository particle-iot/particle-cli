const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME
} = require('../lib/env');


describe('Variable Commands [@device]', () => {
	const help = [
		'Retrieve and monitor variables on your device',
		'Usage: particle variable <command>',
		'Help:  particle help variable <command>',
		'',
		'Commands:',
		'  list     Show variables provided by your device(s)',
		'  get      Retrieve a value from your device',
		'  monitor  Connect and display messages from a device',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
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
		const { stdout, stderr, exitCode } = await cli.run(['help', 'variable']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('variable');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['variable', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Lists all available variables', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['variable', 'list']);

		expect(stdout).to.include(`${DEVICE_NAME} (${DEVICE_ID}) has`);
		expect(stdout).to.include('name (string)');
		expect(stdout).to.include('version (int32)');
		expect(stdout).to.include('blinking (int32)');
		expect(stderr).to.include('polling server to see what devices are online, and what variables are available');
		expect(exitCode).to.equal(0);
	});

	it('Lists all available variables (alt)', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['variable', 'get']);

		expect(stdout).to.include(`${DEVICE_NAME} (${DEVICE_ID}) has`);
		expect(stdout).to.include('name (string)');
		expect(stdout).to.include('version (int32)');
		expect(stdout).to.include('blinking (int32)');
		expect(stderr).to.include('polling server to see what devices are online, and what variables are available');
		expect(exitCode).to.equal(0);
	});

	it('Lists variables available on device and prompts to pick', async () => {
		const subprocess = cli.run(['variable', 'get', DEVICE_ID]);

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
		const args = ['variable', 'get', DEVICE_ID, 'version', '--time'];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const [timestamp, version] = stdout.split(', ');

		expect(timestamp.split(':')).to.have.lengthOf(4);
		expect(version).to.equal('42');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Monitors a variable', async () => {
		const args = ['variable', 'monitor', DEVICE_ID, 'version', '--delay', 1000];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [msg, ...results] = all.split('\n');

		expect(msg).to.equal('Hit CTRL-C to stop!');
		expect(results).to.have.lengthOf.above(2);
		expect(isCanceled).to.equal(true);
	});
});

