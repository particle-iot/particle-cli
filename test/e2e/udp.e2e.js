const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');


describe('UDP Commands', () => {
	const help = [
		'Talk UDP to repair devices, run patches, check Wi-Fi, and more!',
		'Usage: particle udp <command>',
		'Help:  particle help udp <command>',
		'',
		'Commands:',
		'  send    Sends a UDP packet to the specified host and port',
		'  listen  Listens for UDP packets on an optional port (default 5549)',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'udp']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('udp');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['udp', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Sends and receives packet', async () => {
		const port = 3000;
		const host = '127.0.0.1';
		const subprocess = cli.run(['udp', 'listen', port]);

		await delay(1000);
		await cli.run(['udp', 'send', host, port, 'hello']);
		await delay(1000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;

		expect(all).to.include(`Listening for UDP packets on port ${port}`);
		expect(all).to.include(`[${host}] hello`);
		expect(isCanceled).to.equal(true);
	});
});

