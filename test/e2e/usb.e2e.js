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
		'  stop-listening   Make a device exit the listening mode',
		'  safe-mode        Put a device into the safe mode',
		'  dfu              Put a device into the DFU mode',
		'  reset            Reset a device',
		'  configure        Update the system USB configuration',
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

	it('Lists connected devices', async () => {
		const platform = capitalize(DEVICE_PLATFORM_NAME);
		const { stdout, stderr, exitCode } = await cli.run(['usb', 'list']);

		expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Starts & stops listening', async () => {
		await cli.run(['usb', 'start-listening']);
		await delay(2000);

		const { stdout, stderr, exitCode } = await cli.run(['serial', 'identify']);
		expect(stdout).to.include(`Your device id is ${DEVICE_ID}`);
		expect(stdout).to.include('Your system firmware version is');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await cli.run(['usb', 'stop-listening']);
		await delay(2000);

		// TODO (mirande): need a way to ask the device what 'mode' it is in
		const subproc = await cli.run(['serial', 'identify']);
		expect(subproc.stdout).to.equal('Serial timed out'); // TODO (mirande): should be stderr?
		expect(subproc.stderr).to.equal('');
		expect(subproc.exitCode).to.equal(1);
	});
});

