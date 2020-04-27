const capitalize = require('lodash/capitalize');
const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_NAME
} = require('../lib/env');


describe('USB Commands [@device]', () => {
	const help = [
		'Control USB devices',
		'Usage: particle usb <command>',
		'Help:  particle help usb <command>',
		'',
		'Commands:',
		'  list             List the devices connected to the host computer',
		'  start-listening  Put a device into the listening mode',
		'  listen           alias for start-listening',
		'  stop-listening   Make a device exit the listening mode',
		'  safe-mode        Put a device into the safe mode',
		'  dfu              Put a device into the DFU mode',
		'  reset            Reset a device',
		'  setup-done       Set the setup done flag',
		'  configure        Update the system USB configuration',
		'  cloud-status     Check a device\'s cloud connection state',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.run(['usb', 'setup-done']);
		await delay(2000);
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

	describe('List Subcommand', () => {
		const platform = capitalize(DEVICE_PLATFORM_NAME);
		let args;

		beforeEach(() => {
			args = ['usb', 'list'];
		});

		it('Lists connected devices', async () => {
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
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
			const { knownPlatforms } = require('../../settings');
			const platformNames = Object.entries(knownPlatforms)
				.map(({ 1: name }) => name.replace(/\s/, '').toLowerCase());
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
			args.push('online');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by `offline` state', async () => {
			args.push('offline');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.not.include(DEVICE_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});

	describe('Start-Listening Subcommand', () => {
		afterEach(async () => {
			await cli.run(['usb', 'stop-listening']);
			await delay(2000);
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

	describe('Stop-Listening Subcommand', () => {
		beforeEach(async () => {
			await cli.run(['usb', 'start-listening']);
			await delay(2000);
		});

		it('Stops listening', async () => {
			await cli.run(['usb', 'stop-listening']);
			await delay(2000);

			// TODO (mirande): need a way to ask the device what 'mode' it is in
			const { stdout, stderr, exitCode } = await cli.run(['serial', 'identify']);

			expect(stdout).to.equal('Serial timed out'); // TODO (mirande): should be stderr?
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Setup-Done Subcommand', () => {
		it('Sets and clears the setup done flag', async () => {
			await cli.run(['usb', 'setup-done', '--reset']);
			await delay(2000);

			const platform = capitalize(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(['usb', 'list']);
			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform}, LISTENING)`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.run(['usb', 'setup-done']);
			await delay(2000);

			const subproc = await cli.run(['usb', 'list']);
			expect(subproc.stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(subproc.stderr).to.equal('');
			expect(subproc.exitCode).to.equal(0);
		});
	});

	describe('DFU Subcommand', () => {
		it('Enters DFU mode with confirmation', async () => {
			await cli.run(['usb', 'dfu', DEVICE_ID]);

			const platform = capitalize(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(['usb', 'list']);
			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform}, DFU)`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.resetDevice();

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

	describe('Cloud Status Subcommand', () => {
		it('Reports current cloud connection status', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['usb', 'cloud-status', DEVICE_NAME]);

			expect(stdout).to.equal('connected');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Reports current cloud connection status for device id', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['usb', 'cloud-status', DEVICE_ID]);

			expect(stdout).to.equal('connected');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Polls cloud connection status using the `--until` flag', async () => {
			await cli.run(['usb', 'reset', DEVICE_ID]);

			const args = ['usb', 'cloud-status', DEVICE_ID, '--until', 'connected'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('connected');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails with timeout error when polling cloud connection status using the `--until` flag', async () => {
			const args = ['usb', 'cloud-status', DEVICE_ID, '--until', 'disconnecting', '--timeout', 2 * 1000];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('timed-out waiting for status...');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});
});

