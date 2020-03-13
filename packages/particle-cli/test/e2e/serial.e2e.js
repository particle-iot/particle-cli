const words = require('lodash/words');
const capitalize = require('lodash/capitalize');
const { expect } = require('../setup');
const { runForAtLeast } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_PLATFORM_ID,
	DEVICE_PLATFORM_NAME
} = require('../lib/env');


describe('Serial Commands [@device]', () => {
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
		'  flash     Flash firmware over serial using YMODEM protocol',
		'  claim     Claim a device with the given claim code',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.startListeningMode();
	});

	after(runForAtLeast(15, async () => {
		await cli.stopListeningMode();
	}));

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

	it('Lists devices', async () => {
		const platform = capitalize(DEVICE_PLATFORM_NAME);
		const { stdout, stderr, exitCode } = await cli.run(['serial', 'list']);

		expect(stdout).to.include('Found 1 device connected via serial');
		expect(stdout).to.include(platform);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Identifies device', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['serial', 'identify']);

		expect(stdout).to.include(`Your device id is ${DEVICE_ID}`);
		expect(stdout).to.include('Your system firmware version is');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Inspects device', async () => {
		const platform = capitalize(DEVICE_PLATFORM_NAME);
		const { stdout, stderr, exitCode } = await cli.run(['serial', 'inspect']);
		const pass = words(stdout).filter(w => w === 'PASS');

		expect(stdout).to.not.include('FAIL');
		expect(stdout).to.include(`Platform: ${DEVICE_PLATFORM_ID} - ${platform}`);
		expect(pass).to.have.lengthOf.at.least(16);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

