const words = require('lodash/words');
const capitalize = require('lodash/capitalize');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_ID,
	DEVICE_PLATFORM_NAME,
	DEVICE_CELLULAR_IMEI,
	DEVICE_CELLULAR_ICCID
} = require('../lib/env');


describe.only('Serial Commands for Protected Devices [@device]', () => {
	const help = [
		'Simple serial interface to your devices',
		'Usage: particle serial <command>',
		'Help:  particle help serial <command>',
		'',
		'Commands:',
		'  list      Show devices connected via serial to your computer',
		'  monitor   Connect and display messages from a device',
		'  identify  Ask for and display device ID via serial',
		'  wifi      Configure Wi-Fi credentials over serial',
		'  mac       Ask for and display MAC address via serial',
		'  inspect   Ask for and display device module information via serial',
		'  flash     DEPRECATED. Flash firmware using USB. Use flash --local instead',
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
		const { stdout, stderr, exitCode } = await cli.run(['help', 'serial']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('serial');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['serial', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('Serial List Subcommand', () => {
		it('Lists devices', async () => {
			const platform = capitalize(DEVICE_PLATFORM_NAME);

			const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['serial', 'list']);
			const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(stdout).to.include('Found 1 device connected via serial');
			expect(stdout).to.include(`${platform} - ${DEVICE_ID}`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});
	});

	describe('Serial Identify Subcommand', () => {
		it('Identifies a wifi device', async () => {
			const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['serial', 'identify']);
			const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(stdout).to.include(`Your device id is ${DEVICE_ID}`);
			expect(stdout).to.include('Your system firmware version is');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});

		// skip test for non-cellular device
		(DEVICE_CELLULAR_ICCID ? it : it.skip)('Identifies a cellular device', async () => {
			const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['serial', 'identify']);
			const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			expect(stdout).to.include(`Your device id is ${DEVICE_ID}`);
			expect(stdout).to.include(`Your IMEI is ${DEVICE_CELLULAR_IMEI}`);
			expect(stdout).to.include(`Your ICCID is ${DEVICE_CELLULAR_ICCID}`);
			expect(stdout).to.include('Your system firmware version is');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});
	});

	describe('Serial Inspect Subcommand', () => {
		it('Inspects device', async () => {
			const platform = capitalize(DEVICE_PLATFORM_NAME);

			const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['serial', 'inspect']);
			const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			const pass = words(stdout).filter(w => w === 'PASS');

			expect(stdout).to.not.include('FAIL');
			expect(stdout).to.include(`Platform: ${DEVICE_PLATFORM_ID} - ${platform}`);
			expect(pass).to.have.lengthOf.at.least(16);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});
	});

	describe('Serial Mac Subcommand', () => {
		it('Gets MAC address from device', async () => {
			const macAddressPtn = /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/;

			const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { stdout, stderr, exitCode } = await cli.run(['serial', 'mac']);
			const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);

			const [address] = stdout.trim().match(macAddressPtn);

			expect(stdout).to.include(`Your device MAC address is ${address}`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
			expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
		});
	});

	describe('Serial Monitor Subcommand', () => {
		after(async () => {
			await cli.callStrobyStop(DEVICE_NAME);
		});

		it('Monitors serialport output', async () => {
			await cli.callStrobyStart(DEVICE_NAME);
			const received = [];

			const { stdout: stdoutPBefore } = await cli.run(['device-protection', 'status']);
			const { exitCode } = await cli.waitForResult(['serial', 'monitor'], (data) => {
				const log = data.toString('utf8');

				received.push(log);

				if (received.length > 5){
					return true;
				}
				return false;
			});
			const { stdout: stdoutPAfter } = await cli.run(['device-protection', 'status']);
			const [msg, status, ...logs] = received.join('').split(/\r?\n/).filter(x => !!x);

			expect(msg).to.include('Opening serial monitor for com port:');
			expect(status).to.equal('Serial monitor opened successfully:');
			expect(logs).to.have.lengthOf.above(1);
			logs.forEach(l => expect(l).to.equal(`${DEVICE_ID.substring(0, 6)} - active`));
			expect(exitCode).to.equal(0);
			expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
			expect((stdoutPAfter.split('\n'))[0]).to.include('Service Mode');
		});
	});
});

