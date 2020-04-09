const capitalize = require('lodash/capitalize');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_NAME,
	PRODUCT_01_ID,
	PRODUCT_01_DEVICE_02_ID,
	PRODUCT_01_DEVICE_01_NAME
} = require('../lib/env');


describe('Function Commands [@device]', () => {
	const fn = 'check';
	const help = [
		'Call functions on your device',
		'Usage: particle function <command>',
		'Help:  particle help function <command>',
		'',
		'Commands:',
		'  list  Show functions provided by your device(s)',
		'  call  Call a particular function on a device',
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
		const { stdout, stderr, exitCode } = await cli.run(['help', 'function']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('function');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['function', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Lists available functions', async () => {
		const platform = capitalize(DEVICE_PLATFORM_NAME);
		const { stdout, stderr, exitCode } = await cli.run(['function', 'list']);

		expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
		expect(stdout).to.include('int toggle (String args)');
		expect(stdout).to.include('int check (String args)');
		expect(stderr).to.include('polling server to see what devices are online, and what functions are available');
		expect(exitCode).to.equal(0);
	});

	it('Calls a function', async () => {
		const args = ['function', 'call', DEVICE_NAME, fn];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout.slice(-3)).to.equal('200');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Calls a function', async () => {
		const args = ['function', 'call', DEVICE_NAME, fn];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout.slice(-3)).to.equal('200');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Calls a function on a product device', async () => {
		const args = ['function', 'call', PRODUCT_01_DEVICE_02_ID, fn, '--product', PRODUCT_01_ID];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout.slice(-3)).to.equal('200');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	// TODO (mirande): this seems like a bug
	it('Fails when attempting to calls a function on a product device by name', async () => {
		const args = ['function', 'call', PRODUCT_01_DEVICE_01_NAME, fn, '--product', PRODUCT_01_ID];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include(`Function call failed: Function \`${fn}\` not found`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('Fails when attempting to target an unknown device', async () => {
		const args = ['function', 'call', 'DOESNOTEXIST', 'WATNOPE'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include('Error calling function: `WATNOPE`');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('Fails when attempting to call an unknown function', async () => {
		const args = ['function', 'call', DEVICE_NAME, 'WATNOPE'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include('Function call failed: Function `WATNOPE` not found');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});

