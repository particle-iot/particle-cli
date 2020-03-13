const { expect } = require('../setup');
const cli = require('../lib/cli');


describe('Publish Commands', () => {
	const eventName = 'teste2eevent';
	const help = [
		'Publish an event to the cloud',
		'Usage: particle publish [options] <event> [data]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --private  Publish to the private stream  [boolean] [default: true]',
		'  --public   Publish to the public stream  [boolean]',
		'',
		'Examples:',
		'  particle publish temperature 25.0  Publish a temperature event to your private event stream'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'publish']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('publish');

		expect(stdout).to.equal('Parameter \'event\' is required.');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(1);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['publish', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Publishes an event', async () => {
		const args = ['publish', eventName];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal(`Published private event: ${eventName}${'\n'}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Publishes a private event', async () => {
		const args = ['publish', eventName, '--private'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal(`Published private event: ${eventName}${'\n'}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Publishes a public event', async () => {
		const args = ['publish', eventName, '--public'];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal(`Published public event: ${eventName}${'\n'}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

