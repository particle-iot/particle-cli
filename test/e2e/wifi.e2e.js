const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	WIFI_SSID,
	WIFI_CREDS_FILE
} = require('../lib/env');


describe('Wi-Fi Commands [@device,@wifi]', () => {
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

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('wifi');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['wifi', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('WiFi Commands', () => {
		it('Adds a Wi-Fi network', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'add', '--file', WIFI_CREDS_FILE]);

			expect(stdout).to.include(`Wi-Fi network '${WIFI_SSID}' added successfully.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Joins a Wi-Fi network', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'join', '--file', WIFI_CREDS_FILE]);

			expect(stdout).to.include(`Wi-Fi network '${WIFI_SSID}' configured successfully. Attempting to join...\nUse particle wifi current to check the current network.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Joins a known Wi-Fi network', async () => {
			// expect that the network is present in the list
			const { stdout: listStdout } = await cli.run(['wifi', 'list']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'join', '--ssid', WIFI_SSID]);

			expect(listStdout).to.include(WIFI_SSID);
			expect(stdout).to.include(`Wi-Fi network '${WIFI_SSID}' configured successfully. Attemping to join...\nUse particle wifi current to check the current network.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fetches the current network the device is connected to', async () => {
			// Let the device join a network and then clear it
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'current']);

			expect(stdout).to.include(WIFI_SSID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists networks on the device', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'list']);

			expect(stdout).to.include('List of Wi-Fi networks on the device:');
			expect(stdout).to.include(WIFI_SSID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('removes a Wi-Fi network', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'remove', '--ssid', WIFI_SSID]);

			const { stdout: listStdout } = await cli.run(['wifi', 'list']);

			expect(stdout).to.include(`Wi-Fi network ${WIFI_SSID} removed from device's list successfully.`);
			expect(listStdout).to.not.include(WIFI_SSID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Clears networks from the device', async () => {
			// Let the device add a network and then clear it
			await cli.run(['wifi', 'add', '--file', WIFI_CREDS_FILE]);
			const { stdout: listStdoutBeforeClearing } = await cli.run(['wifi', 'list']);
			const { stdout, stderr, exitCode } = await cli.run(['wifi', 'clear']);
			const { stdout : listStdoutAfterClearing }  = await cli.run(['wifi', 'list']);

			expect(listStdoutBeforeClearing).to.include(WIFI_SSID);
			expect(stdout).to.include('Wi-Fi networks cleared successfully.');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect(listStdoutAfterClearing).to.not.include(WIFI_SSID);
		});
	});

});

