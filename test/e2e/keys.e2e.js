const path = require('path');
const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const dfuUtil = require('../lib/dfu-util');
const openSSL = require('../lib/open-ssl');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	DEVICE_ID,
	DEVICE_NAME,
	PATH_TMP_DIR,
	DEVICE_PLATFORM_NAME
} = require('../lib/env');


describe('Keys Commands [@device]', () => {
	const extendedTimeout = 5 * 60 * 1000;

	const help = [
		'Manage your device\'s key pair and server public key',
		'Usage: particle keys <command>',
		'Help:  particle help keys <command>',
		'',
		'Commands:',
		'  new       Generate a new set of keys for your device',
		'  load      Load a key saved in a file onto your device',
		'  save      Save a key from your device to a file',
		'  send      Tell a server which key you\'d like to use by sending your public key in PEM format',
		'  doctor    Creates and assigns a new key to your device, and uploads it to the cloud',
		'  server    Switch server public keys.',
		'  address   Read server configured in device server public key',
		'  protocol  Retrieve or change transport protocol the device uses to communicate with the cloud',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	const dfuInstructions = [
		'!!! I was unable to detect any devices in DFU mode...',
		'> Your device will blink yellow when in DFU mode.',
		'> If your device is not blinking yellow, please:',
		'1) Press and hold both the RESET/RST and MODE/SETUP buttons simultaneously.',
		'2) Release only the RESET/RST button while continuing to hold the MODE/SETUP button.',
		'3) Release the MODE/SETUP button once the device begins to blink yellow.'
	];

	before(async () => {
		await Promise.all([openSSL.ensureExists(), dfuUtil.ensureExists()]);
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'keys']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('keys');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['keys', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('New Subcommand', () => {
		const filename = path.join(PATH_TMP_DIR, `${DEVICE_NAME}.pem`);
		const expectedKeys = [`${DEVICE_NAME}.der`, `${DEVICE_NAME}.pem`, `${DEVICE_NAME}.pub.pem`];

		afterEach(async () => {
			await cli.resetDevice();
		});

		it('Generate a new set of keys for your device', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'new', filename]);

			expect(stdout).to.equal('New Key Created!');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			for (const key of expectedKeys){
				const stats = await fs.stat(path.join(PATH_TMP_DIR, key));
				expect(stats.size).to.be.above(100);
			}
		});

		it('Generate a new set of keys for your device using `--protocol udp`', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'new', '--protocol', 'udp', filename]);

			expect(stdout).to.equal('New Key Created!');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			for (const key of expectedKeys){
				const stats = await fs.stat(path.join(PATH_TMP_DIR, key));
				expect(stats.size).to.be.above(100);
			}
		});

		it('Generate a new set of keys for your device using `--protocol tcp`', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'new', '--protocol', 'tcp', filename]);

			expect(stdout).to.equal('New Key Created!');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			for (const key of expectedKeys){
				const stats = await fs.stat(path.join(PATH_TMP_DIR, key));
				expect(stats.size).to.be.above(100);
			}
		});

		it('Fails to create new keys when device is not in DFU mode', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'new']);
			const instructions = [...dfuInstructions, 'Error creating keys: No DFU device found'];

			expect(stdout.split('\n')).to.include.members(instructions);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Save Subcommand', () => {
		const filename = path.join(PATH_TMP_DIR, `${DEVICE_NAME}.pem`);
		const expectedKeys = [`${DEVICE_NAME}.der`, `${DEVICE_NAME}.pub.pem`];
		const help = [
			'Save a key from your device to a file',
			'Usage: particle keys save [options] <filename>',
			'',
			'Global Options:',
			'  -v, --verbose  Increases how much logging to display  [count]',
			'  -q, --quiet    Decreases how much logging to display  [count]',
			'',
			'Options:',
			'  --force  Force overwriting of <filename> if it exists  [boolean] [default: false]'
		];

		afterEach(async () => {
			await cli.resetDevice();
		});

		after(async () => {
			// TODO (mirande): replace w/ `cli.waitForDeviceToGetOnline()`
			// helper when available
			await delay(30 * 1000);
		});

		it('Saves device keys', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'save', filename]);

			expect(stdout).to.equal('Saved!');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			for (const key of expectedKeys){
				const stats = await fs.stat(path.join(PATH_TMP_DIR, key));
				expect(stats.size).to.be.above(100);
			}
		});

		it('Fails to save device keys when device is not in DFU mode', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'save', filename]);

			expect(stdout.split('\n')).to.include.members(dfuInstructions);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0); // TODO (mirande): fix: inconsistent error code - see `particle new`
		});

		it('Fails to save device keys when filename is not provided', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'save']);

			expect(stdout).to.equal('Parameter \'filename\' is required.');
			expect(stderr.split('\n')).to.include.members(help);
			expect(exitCode).to.equal(1);
		});
	});

	describe('Doctor Subcommand', () => {
		before(async () => {
			await cli.setTestProfileAndLogin();
			await cli.flashStrobyFirmwareOTAForTest();
		});

		it('Fixes devices keys', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'doctor', DEVICE_ID]);
			const log = [
				'New Key Created!',
				'Saved!',
				'Saved!',
				`attempting to add a new public key for device ${DEVICE_ID}`,
				'submitting public key succeeded!',
				'Okay!  New keys in place, your device should restart.',
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.waitForVariable('name', 'stroby');
		}).timeout(extendedTimeout);

		it('Fails to fix device keys when device is not in DFU mode', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'doctor', DEVICE_ID]);

			expect(stdout.split('\n')).to.include.members(dfuInstructions);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Server Subcommand', () => {
		before(async () => {
			await cli.setTestProfileAndLogin();
			await cli.flashStrobyFirmwareOTAForTest();
		});

		it('Switches server public keys', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'server']);

			expect(stdout).to.equal('Okay!  New keys in place, your device will not restart.');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.resetDevice();
			await cli.waitForVariable('name', 'stroby');
		}).timeout(extendedTimeout);

		it('Fails to switch server public keys when device is not in DFU mode', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'server']);

			expect(stdout.split('\n')).to.include.members(dfuInstructions);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Address Subcommand', () => {
		it('Reads server address from device\'s server public key', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'address']);
			const addressPtn = /(udp|tcp):\/\/(\$id\.udp\.particle\.io|\$id\.udp-mesh\.particle\.io|device\.spark\.io):?(\d{1,5})?/;

			expect(stdout.trim()).to.match(addressPtn);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.resetDevice();
		}).timeout(extendedTimeout);

		it('Fails to save device keys when device is not in DFU mode', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'address']);

			expect(stdout.split('\n')).to.include.members(dfuInstructions);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Protocol Subcommand', () => {
		it('Reads server address from device\'s server public key', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'protocol']);
			const protocolPtn = /(udp|tcp)$/;

			expect(stdout).to.include('Device protocol is set to ');
			expect(stdout.trim()).to.match(protocolPtn);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.resetDevice();
		}).timeout(extendedTimeout);

		it('Fails to save device keys when device is not in DFU mode', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'protocol']);

			expect(stdout.split('\n')).to.include.members(dfuInstructions);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});
});

