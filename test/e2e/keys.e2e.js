const path = require('path');
const { expect } = require('../setup');
const openSSL = require('../lib/open-ssl');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	DEVICE_ID,
	DEVICE_NAME,
	PATH_TMP_DIR,
	PATH_REPO_DIR
} = require('../lib/env');
const { delay } = require('../lib/mocha-utils');


describe('Keys Commands [@device]', function cliKeysCommands(){
	this.timeout(5 * 60 * 1000);

	const help = [
		'Manage your device\'s key pair and server public key',
		'Usage: particle keys <command>',
		'Help:  particle help keys <command>',
		'',
		'Commands:',
		'  new      Generate a new set of keys for your device',
		'  load     Load a key saved in a file onto your device',
		'  save     Save a key from your device to a file',
		'  send     Tell a server which key you\'d like to use by sending your public key in PEM format',
		'  doctor   Creates and assigns a new key to your device, and uploads it to the cloud',
		'  server   Switch server public keys.',
		'  address  Read server configured in device server public key',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await openSSL.ensureExists();
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

	describe('Keys New Subcommand', () => {
		const filename = path.join(PATH_TMP_DIR, `${DEVICE_NAME}`);
		const expectedKeys = [`${DEVICE_NAME}.der`, `${DEVICE_NAME}.pem`, `${DEVICE_NAME}.pub.pem`];

		afterEach(async () => {
			await cli.resetDevice();
			await delay(5000);
			await cli.waitUntilOnline();
		});

		it('Generate a new set of keys for your device', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'new', filename]);

			expect(stdout).to.equal(`New key ${DEVICE_NAME}.der created for device ${DEVICE_ID}`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			for (const key of expectedKeys){
				const stats = await fs.stat(path.join(PATH_TMP_DIR, key));
				expect(stats.size).to.be.above(100);
			}
		});
	});

	describe('Keys Save Subcommand', () => {
		const filename = path.join(PATH_TMP_DIR, `${DEVICE_NAME}.pem`);
		const expectedKeys = [`${DEVICE_NAME}.der`, `${DEVICE_NAME}.pub.pem`];

		it('Saves device keys', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'save', filename]);

			expect(stdout).to.match(/Saved existing key/);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			for (const key of expectedKeys){
				const stats = await fs.stat(path.join(PATH_TMP_DIR, key));
				expect(stats.size).to.be.above(100);
			}

			await cli.resetDevice();
			await cli.waitUntilOnline();
		});
	});

	describe('Keys Doctor Subcommand', () => {
		before(async () => {
			await cli.setTestProfileAndLogin();
		});

		it('Fixes devices keys', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'doctor', DEVICE_ID]);
			const log = [
				`New key ${DEVICE_ID}_ec_new.der created for device ${DEVICE_ID}`,
				`Saved existing key to backup_ec_${DEVICE_ID}_ec_new.der`,
				`Key ${DEVICE_ID}_ec_new.der written to device`,
				`attempting to add a new public key for device ${DEVICE_ID}`,
				'submitting public key succeeded!',
				'Okay!  New keys in place, your device should restart.',
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.waitUntilOnline();
		});
	});

	describe('Keys Server Subcommand', () => {
		before(async () => {
			await cli.setTestProfileAndLogin();
		});

		it('Switches server public keys', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'server']);

			expect(stdout).to.equal('Okay!  New keys in place, your device will not restart.');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.resetDevice();
			await cli.waitUntilOnline();
		});

		it('Saves server public keys locally when `--deviceType` flag is set', async () => {
			const filename = path.join(PATH_REPO_DIR, 'assets/keys/rsa.pub.der');
			const args = ['keys', 'server', filename, '--deviceType', 'photon'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('Okay!  Formatted server key file generated for this type of device.');
			expect(stderr).to.exist;
			expect(exitCode).to.equal(0);
		});

		it('Fails when `--deviceType` is set but `filename` param is omitted', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'server', '--deviceType', 'Electron']);

			expect(stdout).to.equal('`filename` parameter is required when `--deviceType` is set');
			expect(stderr).to.include('Usage: particle keys server [options] [filename] [outputFilename]');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Keys Address Subcommand', () => {
		after(async () => {
			await cli.resetDevice();
			await delay(5000);
			await cli.waitUntilOnline();
		});

		it('Reads server address from device\'s server public key', async () => {
			await cli.enterDFUMode();
			const { stdout, stderr, exitCode } = await cli.run(['keys', 'address']);
			const addressPtn = /(udp|tcp):\/\/(\$id\.udp\.particle\.io|\$id\.udp-mesh\.particle\.io|device\.spark\.io):?(\d{1,5})?/;

			expect(stdout.trim()).to.match(addressPtn);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});
});

