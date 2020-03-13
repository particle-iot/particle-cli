const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME
} = require('../lib/env');


describe('Update Commands [@device]', () => {
	const help = [
		'Update the system firmware of a device via USB',
		'Usage: particle update [options]',
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
		const { stdout, stderr, exitCode } = await cli.run(['help', 'update']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['update', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Updates to latest default Device OS version', async () => {
		await cli.enterDFUMode();
		const { stdout, stderr, exitCode } = await cli.run(['update']);

		expect(stdout).to.include('> Your device is ready for a system update.');
		expect(stdout).to.include('> This process should take about 30 seconds. Here it goes!');
		expect(stdout).to.include('! System firmware update successfully completed!');
		expect(stdout).to.include('> Your device should now restart automatically.');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await delay(5000);
		const cmd = await cli.run(['usb', 'list']);

		expect(cmd.stdout).to.include(DEVICE_ID);
		expect(cmd.stdout).to.include(DEVICE_NAME);
	});

	it('Shows error when device is not in dfu-mode', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['update']);
		const log = [
			'!!! I was unable to detect any devices in DFU mode...',
			'> Your device will blink yellow when in DFU mode.',
			'> If your device is not blinking yellow, please:',
			'1) Press and hold both the RESET/RST and MODE/SETUP buttons simultaneously.',
			'2) Release only the RESET/RST button while continuing to hold the MODE/SETUP button.',
			'3) Release the MODE/SETUP button once the device begins to blink yellow.'
		];

		// TODO (mirande): should this output be sent to stderr?
		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});

