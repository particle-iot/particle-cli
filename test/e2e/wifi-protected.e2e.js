const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	WIFI_SSID,
	WIFI_CREDS_FILE
} = require('../lib/env');
const stripAnsi = require('strip-ansi');

describe.only('Wi-Fi Commands for Protected Devices [@device,@wifi]', () => {
	const help = [
		'Configure Wi-Fi credentials to your device (Supported on Gen 3+ devices).',
		'Usage: particle wifi <command>',
		'Help:  particle help wifi <command>',
		'',
		'Commands:',
		'  add      Adds a Wi-Fi network to your device',
		'  join     Joins a Wi-Fi network',
		'  clear    Clears the list of Wi-Fi networks on your device',
		'  list     Lists the Wi-Fi networks on your device',
		'  remove   Removes a Wi-Fi network from the device',
		'  current  Gets the current Wi-Fi network',
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
		await cli.run(['usb', 'setup-done']);
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'wifi']);

		expect(stripAnsi(stdout)).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('wifi');

		expect(stripAnsi(stdout)).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['wifi', '--help']);

		expect(stripAnsi(stdout)).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('WiFi Commands', () => {
        before(async () => {
            await cli.run(['wifi', 'clear']);
        });

        beforeEach(async () => {
            await cli.run(['device-protection', 'enable']);
        });

		it('Adds a Wi-Fi network', async () => {
            const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'add', '--file', WIFI_CREDS_FILE]);
            const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(stripAnsi(stdout)).to.include(`Wi-Fi network '${WIFI_SSID}' added successfully.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
            expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});

		it('Joins a Wi-Fi network', async () => {
            const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'join', '--file', WIFI_CREDS_FILE]);
            const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(stripAnsi(stdout)).to.include(`Wi-Fi network '${WIFI_SSID}' configured successfully. Attempting to join...\nUse particle wifi current to check the current network.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
            expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});

		it('Joins a known Wi-Fi network', async () => {
			// expect that the network is present in the list
            const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout: listStdout } = await cli.run(['wifi', 'list']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'join', '--ssid', WIFI_SSID]);
            const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(listStdout).to.include(WIFI_SSID);
			expect(stripAnsi(stdout)).to.include(`Wi-Fi network '${WIFI_SSID}' configured successfully. Attemping to join...\nUse particle wifi current to check the current network.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
            expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});

		it('Fetches the current network the device is connected to', async () => {
			// Let the device join a network and then clear it
            const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'current']);
            const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(stripAnsi(stdout)).to.include(WIFI_SSID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
            expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});

		it('Lists networks on the device', async () => {
            const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'list']);
            const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(stripAnsi(stdout)).to.include('List of Wi-Fi networks on the device:');
			expect(stripAnsi(stdout)).to.include(WIFI_SSID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
            expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});

		it('removes a Wi-Fi network', async () => {
            const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'remove', '--ssid', WIFI_SSID]);
            const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			const { stdout: listStdout } = await cli.run(['wifi', 'list']);

			expect(stripAnsi(stdout)).to.include(`Wi-Fi network ${WIFI_SSID} removed from device's list successfully.`);
			expect(listStdout).to.not.include(WIFI_SSID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
            expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});

		it('Clears networks from the device', async () => {
			// Let the device add a network and then clear it
            const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			await cli.run(['wifi', 'add', '--file', WIFI_CREDS_FILE]);
			const { stdout: listStdoutBeforeClearing } = await cli.run(['wifi', 'list']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'clear']);
			const { stdout : listStdoutAfterClearing }  = await cli.run(['wifi', 'list']);
            const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(stripAnsi(listStdoutBeforeClearing)).to.include(WIFI_SSID);
			expect(stripAnsi(stdout)).to.include('Wi-Fi networks cleared successfully.');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(stripAnsi(listStdoutAfterClearing)).to.not.include(WIFI_SSID);
            expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});
	});

});

