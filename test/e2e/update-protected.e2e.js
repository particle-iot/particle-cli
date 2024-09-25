const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME, DEVICE_PLATFORM_NAME
} = require('../lib/env');
const stripAnsi = require('strip-ansi');
const { delay } = require('../lib/mocha-utils');


describe('Update Commands for Protected Devices [@device]', () => {
	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Updates to latest default Device OS version', async () => {
		const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
		const { stdout, stderr, exitCode } = await cli.run(['update']);
		const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

		expect(stripAnsi(stdout)).to.include(`Updating ${DEVICE_PLATFORM_NAME} ${DEVICE_ID} to latest Device OS version`);
		expect(stripAnsi(stdout)).to.include('Update success!');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await delay(5000);
		await cli.waitUntilOnline();
		const cmd = await cli.run(['usb', 'list']);

		expect(cmd.stdout).to.include(DEVICE_ID);
		expect(cmd.stdout).to.include(DEVICE_NAME);
		expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
		expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
	});
});

