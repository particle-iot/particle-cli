const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME
} = require('../lib/env');


describe('Device Commands [@device]', () => {
	const help = [
		'Manipulate a device',
		'Usage: particle device <command>',
		'Help:  particle help device <command>',
		'',
		'Commands:',
		'  add     Register a device with your user account with the cloud',
		'  remove  Release a device from your account so that another user may claim it',
		'  rename  Give a device a name!',
		'  doctor  Put your device back into a healthy state',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.claimTestDevice();
		await cli.revertDeviceName();
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'device']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('device');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['device', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Removes device', async () => {
		const args = ['device', 'remove', DEVICE_NAME, '--yes'];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			`releasing device ${DEVICE_NAME}`,
			'Okay!'
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Claims device', async () => {
		const args = ['device', 'add', DEVICE_ID];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			`Claiming device ${DEVICE_ID}`,
			`Successfully claimed device ${DEVICE_ID}`
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Names a device', async () => {
		const name = `${DEVICE_NAME}-updated`;
		const args = ['device', 'rename', DEVICE_ID, name];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			`Renaming device ${DEVICE_ID}`,
			`Successfully renamed device ${DEVICE_ID} to: ${name}`
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

