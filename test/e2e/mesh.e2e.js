const capitalize = require('lodash/capitalize');
const { expect } = require('../setup');
const { runForAtLeast, delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_NAME
} = require('../lib/env');


describe('Mesh Commands [@device]', () => {
	const networkName = 'teste2emesh';
	const help = [
		'Manage mesh networks',
		'Usage: particle mesh <command>',
		'Help:  particle help mesh <command>',
		'',
		'Commands:',
		'  create  Create a new network',
		'  add     Add a device to a network',
		'  remove  Remove a device from its network',
		'  list    List all networks and their member devices',
		'  info    Get information about the current device\'s network',
		'  scan    Scan for networks',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
		await cli.removeDeviceFromMeshNetwork();
	});

	after(async () => {
		await cli.removeDeviceFromMeshNetwork();
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'mesh']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('mesh');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['mesh', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	// TODO (mirande): figure out what's up w/ the `--interactive` flag.
	it.skip('NYI: Requires forced-interactive mode via unsupported `--interactive` flag', async () => {});

	it.skip('Creates network', runForAtLeast(30, async () => {
		const password = '1234567890';
		const args = ['mesh', 'create', networkName, DEVICE_ID, '--interactive'];
		const subprocess = cli.run(args);

		await delay(1000);
		subprocess.stdin.write(password);
		subprocess.stdin.write('\n');
		await delay(1000);
		subprocess.stdin.write(password);
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(stdout).to.include('Done! The device will be registered in the network once it is connected to the cloud.');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	})).timeout(60 * 1000);

	it.skip('Lists networks', async () => {
		const platform = capitalize(DEVICE_PLATFORM_NAME);
		const args = ['mesh', 'list'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include(networkName);
		expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it.skip('Get network info', async () => {
		const args = ['mesh', 'info', DEVICE_ID];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include(`This device is a member of ${networkName}.`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it.skip('Removes device from network', runForAtLeast(10, async () => {
		const args = ['mesh', 'remove', DEVICE_ID, '--interactive'];
		const subprocess = cli.run(args);

		await delay(1000);
		subprocess.stdin.write('y');
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(stdout).to.include('Done.');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	}));
});

