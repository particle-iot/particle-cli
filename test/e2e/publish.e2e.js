const os = require('os');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const { PRODUCT_01_ID } = require('../lib/env');


describe('Publish Commands', () => {
	const eventName = 'test-e2e-event';
	const help = [
		'Publish an event to the cloud',
		'Usage: particle publish [options] <event> [data]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --product  Publish to the given Product ID or Slug\'s stream  [string]',
		'',
		'Examples:',
		'  particle publish temp 25.0                  Publish a temp event to your private event stream',
		'  particle publish temp 25.0 --product 12345  Publish a temp event to your product 12345\'s event stream',
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
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('publish');

		expect(stdout).to.equal('Parameter \'event\' is required.');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(1);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['publish', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Publishes an event', async () => {
		const args = ['publish', eventName];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include(`Published private event: ${eventName}${os.EOL}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Publishes a product event', async () => {
		const args = ['publish', eventName, '--product', PRODUCT_01_ID];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include(`Published private event: ${eventName} to product: ${PRODUCT_01_ID}${os.EOL}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Publishes a private product event', async () => {
		const args = ['publish', eventName, '--product', PRODUCT_01_ID];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include(`Published private event: ${eventName} to product: ${PRODUCT_01_ID}${os.EOL}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Fails when user is signed-out', async () => {
		await cli.logout();
		const { stdout, stderr, exitCode } = await cli.run(['publish', eventName]);

		expect(stdout).to.include('Error publishing event: The access token was not found');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});

