const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME, DEVICE_PLATFORM_NAME
} = require('../lib/env');


describe('Update Commands [@device]', () => {
	const help = [
		'Update Device OS on a device via USB',
		'Usage: particle update [options] [device]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --target  The Device OS version to update. Defaults to latest version.  [string]',
		'',
		'Examples:',
		'  particle update                      Update Device OS on the device connected over USB',
		'  particle update red                  Update Device OS on device red',
		'  particle update --target 5.0.0 blue  Update Device OS on device blue to version 5.0.0',
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
		const { stdout, stderr, exitCode } = await cli.run(['update']);

		expect(stdout).to.include(`Updating ${DEVICE_PLATFORM_NAME} ${DEVICE_ID} to latest Device OS version`);
		expect(stdout).to.include('Update success!');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await cli.waitUntilOnline();
		const cmd = await cli.run(['usb', 'list']);

		expect(cmd.stdout).to.include(DEVICE_ID);
		expect(cmd.stdout).to.include(DEVICE_NAME);
	});
});

