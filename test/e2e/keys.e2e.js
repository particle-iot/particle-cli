const { expect } = require('../setup');
const cli = require('../lib/cli');


describe('Keys Commands [@device]', () => {
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

	it.skip('NYI: REQUIRES DFU-UTIL + OPENSSL', async () => {});
});

