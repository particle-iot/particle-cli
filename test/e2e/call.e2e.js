const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_NAME
} = require('../lib/env');


describe('Call Commands [@device]', () => {
	const help = [
		'Call a particular function on a device',
		'Usage: particle call [options] <device> <function> [argument]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Examples:',
		'  particle call coffee brew                 Call the brew function on the coffee device',
		'  particle call board digitalWrite D7=HIGH  Call the digitalWrite function with argument D7=HIGH on the board device'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
		await cli.flashStrobyFirmwareOTAForTest();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'call']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('call');

		expect(stdout).to.equal('Parameter \'device\' is required.');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(1);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['call', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Calls a function', async () => {
		const args = ['call', DEVICE_NAME, 'check'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal('200');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Fails when attempting to call an unknown function', async () => {
		const args = ['call', DEVICE_NAME, 'WATNOPE'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal('Function call failed: Function WATNOPE not found');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});

