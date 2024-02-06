const { expect } = require('../setup');
const cli = require('../lib/cli');


describe('Doctor Commands [@device]', () => {
	const help = [
		'NOT SUPPORTED. Go to the device doctor tool at docs.particle.io/tools/doctor',
		'Usage: particle doctor [options]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'doctor']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['doctor', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('is not longer supported', async() => {
		const { stdout, stderr, exitCode } = await cli.run(['doctor', '--help']);

		expect(stdout).to.equal('particle device doctor is no longer supported.\nGo to the device doctor tool at docs.particle.io/tools/doctor.');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

