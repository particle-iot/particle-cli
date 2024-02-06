const { expect } = require('../setup');
const cli = require('../lib/cli');


describe('Setup Commands [@device]', () => {
	const help = [
		'NOT SUPPORTED. Go to setup.particle.io with your browser',
		'Usage: particle setup [options]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		''
	];

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'setup']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['setup', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Returns that this is no longer supported', async() => {
		const { stdout, stderr, exitCode } = await cli.run(['setup']);

		expect(stdout).to.equal('particle setup is no longer supported. Go to setup.particle.io with your browser.');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

