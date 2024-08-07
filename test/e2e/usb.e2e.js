const capitalize = require('lodash/capitalize');
const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_NAME
} = require('../lib/env');
const stripAnsi = require('strip-ansi');


describe('USB Commands [@device]', function cliUSBCommands(){
	this.timeout(5 * 60 * 1000);

	const help = [
		'Control USB devices',
		'Usage: particle usb <command>',
		'Help:  particle help usb <command>',
		'',
		'Commands:',
		'  list                List the devices connected to the host computer',
		'  start-listening     Put a device into the listening mode',
		'  listen              alias for start-listening',
		'  stop-listening      Make a device exit the listening mode',
		'  safe-mode           Put a device into the safe mode',
		'  dfu                 Put a device into the DFU mode',
		'  reset               Reset a device',
		'  setup-done          Set the setup done flag',
		'  configure           Update the system USB configuration',
		'  cloud-status        Check a device\'s cloud connection state',
		'  network-interfaces  Gets the network configuration of the device',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	beforeEach(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.run(['usb', 'setup-done']);
		await cli.waitUntilOnline();
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'usb']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('usb');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['usb', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('USB List Subcommand', () => {
		const platform = capitalize(DEVICE_PLATFORM_NAME);
		let args;

		beforeEach(async () => {
			args = ['usb', 'list'];
			await cli.setTestProfileAndLogin();
		});

		after(async () => {
			await cli.logout();
		});

		it('Lists connected devices', async () => {
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected device ids using the `--ids-only` flag', async () => {
			args.push('--ids-only');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal(DEVICE_ID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by platform name', async () => {
			args.push(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by platform name omitting test device', async () => {
			const { knownPlatformIds } = require('../../src/lib/utilities');
			const platformNames = Object.keys(knownPlatformIds());
			// Derive platform name NOT matching those claimed by E2E test profile
			// (i.e. find single, valid inversion of DEVICE_PLATFORM_NAME)
			const nonE2EDevicePlatform = platformNames.filter(name => name !== DEVICE_PLATFORM_NAME);

			args.push(nonE2EDevicePlatform);
			const { stdout, stderr, exitCode } = await cli.debug(args);

			expect(stdout).to.not.include(DEVICE_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by device name', async () => {
			args.push(DEVICE_NAME);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by device name omitting test device', async () => {
			args.push('non-existent-device-name');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.not.include(DEVICE_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by device id', async () => {
			args.push(DEVICE_ID);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by device id omitting test device', async () => {
			args.push('non-existent-device-id');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.not.include(DEVICE_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by `online` state', async () => {
			await cli.waitUntilOnline();
			args.push('online');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by `offline` state', async () => {
			await cli.waitUntilOnline();
			args.push('offline');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.not.include(DEVICE_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices when signed-in to a foreign account', async () => {
			await cli.logout();
			await cli.loginToForeignAcct();
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`<no name> [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by platform name when signed-in to a foreign account', async () => {
			await cli.logout();
			await cli.loginToForeignAcct();
			args.push(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`<no name> [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to list devices when signed-out', async () => {
			await cli.logout();
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('The access token was not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('USB Start-Listening Subcommand', () => {
		afterEach(async () => {
			await cli.run(['usb', 'stop-listening']);
			await cli.waitUntilOnline();
		});

		it('Starts listening', async () => {
			await cli.run(['usb', 'start-listening']);
			await delay(2000);

			const { stdout, stderr, exitCode } = await cli.run(['serial', 'identify']);

			expect(stdout).to.include(`Your device id is ${DEVICE_ID}`);
			expect(stdout).to.include('Your system firmware version is');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});

	describe('USB Stop-Listening Subcommand', () => {
		beforeEach(async () => {
			await cli.run(['usb', 'start-listening']);
			await delay(2000);
		});

		afterEach(async () => {
			await cli.resetDevice();
			await delay(5000);
			await cli.waitUntilOnline();
		});

		it('Stops listening', async () => {
			await cli.run(['usb', 'stop-listening']);

			const args = ['usb', 'cloud-status', DEVICE_ID, '--until', 'connected'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stripAnsi(stdout)).to.equal('connected');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});

	describe('USB DFU Subcommand', () => {
		after(async () => {
			await cli.resetDevice();
			await delay(5000);
			await cli.waitUntilOnline();
		});

		it('Enters DFU mode with confirmation', async () => {
			await cli.run(['usb', 'dfu', DEVICE_ID]);

			const platform = capitalize(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(['usb', 'list']);
			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform}, DFU)`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.resetDevice();
			await delay(5000);
			await cli.waitUntilOnline();

			const subproc = await cli.run(['usb', 'list']);
			expect(subproc.stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(subproc.stderr).to.equal('');
			expect(subproc.exitCode).to.equal(0);
		});

		it('Fails to enter DFU mode when device is unrecognized', async () => {
			const device = 'DOESNOTEXIST';
			const { stdout, stderr, exitCode } = await cli.run(['usb', 'dfu', device]);

			expect(stdout).to.equal(`Device not found: ${device}`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('USB Cloud Status Subcommand', () => {
		it('Reports current cloud connection status', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['usb', 'cloud-status', DEVICE_NAME]);

			expect(stripAnsi(stdout)).to.equal('connected');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Reports current cloud connection status for device id', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['usb', 'cloud-status', DEVICE_ID]);

			expect(stripAnsi(stdout)).to.equal('connected');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Polls cloud connection status using the `--until` flag', async () => {
			await cli.resetDevice();
			await delay(5000);

			const args = ['usb', 'cloud-status', DEVICE_ID, '--until', 'connected'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stripAnsi(stdout)).to.equal('connected');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails with timeout error when polling cloud connection status using the `--until` flag', async () => {
			const args = ['usb', 'cloud-status', DEVICE_ID, '--until', 'disconnecting', '--timeout', 2 * 1000];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stripAnsi(stdout)).to.equal('timed-out waiting for status...');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('USB network-interfaces Subcommand', () => {
		after(async () => {
			await cli.resetDevice();
			await delay(5000);
			await cli.waitUntilOnline();
		});

		it('provides network interfaces', async () => {
			const ifacePattern = /\w+\(\w+\): flags=\d+<[\w,]+> mtu \d+/;

			const { stdout, stderr, exitCode } = await cli.run(['usb', 'network-interfaces']);

			expect(stdout).to.match(ifacePattern);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});
});

