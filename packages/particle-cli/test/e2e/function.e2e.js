const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME
} = require('../lib/env');


describe('Function Commands [@device]', () => {
	const help = [
		'Call functions on your device',
		'Usage: particle function <command>',
		'Help:  particle help function <command>',
		'',
		'Commands:',
		'  list  Show functions provided by your device(s)',
		'  call  Call a particular function on a device',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
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
		const { stdout, stderr, exitCode } = await cli.run(['help', 'function']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('function');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['function', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Lists available functions', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['function', 'list']);

		expect(stdout).to.include(`${DEVICE_NAME} (${DEVICE_ID}) has`);
		expect(stdout).to.include('int toggle(String args)');
		expect(stdout).to.include('int check(String args)');
		expect(stderr).to.include('polling server to see what devices are online, and what functions are available');
		expect(exitCode).to.equal(0);
	});

	it('Calls a function', async () => {
		const args = ['function', 'call', DEVICE_NAME, 'check'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal('200');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Fails when attempting to call an unknown function', async () => {
		const args = ['function', 'call', DEVICE_NAME, 'WATNOPE'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal('Function call failed: Function WATNOPE not found');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});

