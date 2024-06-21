const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	PRODUCT_01_DEVICE_01_ID,
	PRODUCT_01_ID
} = require('../lib/env');
const { delay } = require('../../src/lib/utilities');

const FLASH_TIME = 15000;

describe('Device Protection Commands [@device,@device-protection]', () => {
	const help = [
		'Manage device protection',
		'Usage: particle device-protection <command>',
		'Help:  particle help device-protection <command>',
		'',
		'Commands:',
		'  status   Gets the current device protection status',
		'  disable  Disables device protection',
		'  enable   Enables device protection',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		''
	];


	before(async () => {
		await cli.setTestProfileAndLogin();
		// Ensure device starts as an Open Device
		await cli.run(['device-protection', 'disable', '--open']);

		// give time to flash the device
		await delay(FLASH_TIME);
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'device-protection']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('device-protection');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['device-protection', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('DeviceProtection Commands', () => {
		it('Gets the current device protection status', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'status']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}): Open device\nRun particle device-protection enable to protect the device.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Attempts to disable protection status on an open device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'disable']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}) is not a protected device.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Enables protection status on the device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'enable']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}) is now a protected device.\nDevice removed from development mode to maintain current settings.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			// give time to flash the device
			await delay(FLASH_TIME);
		});

		it('Gets the current status of a Protected Device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'status']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}): Protected device\nRun particle device-protection disable to put the device in service mode.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Attempts to enable protection status on a protected device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'enable']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}) is already a protected device.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Puts the device in service mode', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'disable']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}) is now in service mode.\nA protected device stays in service mode for a total of 20 reboots or 24 hours.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Turns the device to an open device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'disable', '--open']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}) is now an open device.\nDevice placed in development mode to maintain current settings.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			// give time to flash the device
			await delay(FLASH_TIME);
		});

		it('Gets the current status of the device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'status']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}): Open device\nRun particle device-protection enable to protect the device.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});
});

