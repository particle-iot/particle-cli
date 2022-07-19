const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME
} = require('../lib/env');


describe('Update Commands [@device]', () => {
	const help = [
		'Update the system firmware of a device via USB',
		'Usage: particle update [options] [device]',
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
		const { stdout, stderr, exitCode } = await cli.run(['update']);

		expect(stdout).to.include('> Your device is ready for a system update.');
		expect(stdout).to.include('> This process may take a few minutes. Here it goes!');
		expect(stdout).to.include('! System firmware update successfully completed!');
		expect(stdout).to.include('> Your device should now restart automatically.');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await cli.waitUntilOnline();
		const cmd = await cli.run(['usb', 'list']);

		expect(cmd.stdout).to.include(DEVICE_ID);
		expect(cmd.stdout).to.include(DEVICE_NAME);
	});
});

