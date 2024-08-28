const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	PRODUCT_01_DEVICE_01_ID,
	PRODUCT_01_ID
} = require('../lib/env');

describe('Device Protection Commands [@device,@device-protection]', () => {
	const help = [
		'Manage Device Protection',
		'Usage: particle device-protection <command>',
		'Help:  particle help device-protection <command>',
		'',
		'Commands:',
		'  status   Gets the current Device Protection status',
		'  disable  Disables Device Protection',
		'  enable   Enables Device Protection',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		''
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
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
		it('Enables protection status on the device', async () => {
			// Put device in Service Mode
			await cli.run(['device-protection', 'disable']);

			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'enable']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}) is now a Protected Device.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Gets the current status of a Protected Device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'status']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}): Protected Device\nRun particle device-protection disable to put the device in Service Mode.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Attempts to enable protection status on a Protected Device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'enable']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}) is already a Protected Device.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Puts the device in service mode', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'disable']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}) is now in Service Mode.\nA Protected Device stays in Service Mode for a total of 20 reboots or 24 hours.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Gets the current status of the device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['device-protection', 'status']);

			expect(stdout).to.include(`[${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID}): Protected Device (Service Mode)\nRun particle device-protection enable to take the device out of Service Mode.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});
});

