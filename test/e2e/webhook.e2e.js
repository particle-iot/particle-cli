const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const matches = require('../lib/capture-matches');
const cli = require('../lib/cli');


describe('Webhook Commands', () => {
	const event = 'test-event';
	const url = 'https://example.com/hook';
	const help = [
		'Manage webhooks that react to device event streams',
		'Usage: particle webhook <command>',
		'Help:  particle help webhook <command>',
		'',
		'Commands:',
		'  create  Creates a postback to the given url when your event is sent',
		'  list    Show your current Webhooks',
		'  delete  Deletes a Webhook',
		'  POST    Create a new POST request hook',
		'  GET     Create a new GET request hook',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		// TODO (mirande): work-around for broke `delete all` shortcut
		const { stdout } = await cli.run(['webhook', 'list']);
		const hookIDs = matches(stdout, /Hook ID (.*) is watching for "test-event"/g);
		await hookIDs.reduce((promise, id) => {
			return promise.then(() => cli.run(['webhook', 'delete', id]));
		}, Promise.resolve());
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'webhook']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('webhook');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['webhook', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Creates a webhook', async () => {
		const args = ['webhook', 'create', event, url];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include('Successfully created webhook with ID');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Lists all webhooks', async () => {
		await cli.run(['webhook', 'create', event, url]);

		const { stdout, stderr, exitCode } = await cli.run(['webhook', 'list']);
		const hookIDs = matches(stdout, /Hook ID (.*) is watching for "test-event"/g);

		expect(hookIDs).to.have.lengthOf.at.least(1);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Deletes a webhook by ID', async () => {
		const args = ['webhook', 'create', event, url];
		await cli.run(args);
		const { stdout: log } = await cli.run(args);
		const id = matches(log, /Successfully created webhook with ID (.*)$/g)[0];
		await cli.run(args);

		expect(id).to.be.a('string').with.lengthOf.above(10);

		const { stdout, stderr, exitCode } = await cli.run(['webhook', 'delete', id]);

		expect(stdout).to.equal('');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const { stdout: list } = await cli.run(['webhook', 'list']);
		const hookIDs = matches(list, /Hook ID (.*) is watching for "test-event"/g);

		expect(hookIDs).to.not.include(id);
	});

	// TODO (mirande): only deletes one hook at a time - fix!
	it.skip('BUG: Deletes all webhooks', async () => {
		const { stdout: log } = await cli.run(['webhook', 'create', event, url]);

		expect(log).to.include('Successfully created webhook with ID');

		const subprocess = cli.run(['webhook', 'delete', 'all']);

		await delay(1000);
		subprocess.stdin.write('y');
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(stdout).to.equal('');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const { stdout: list } = await cli.run(['webhook', 'list']);

		expect(list).to.include('Found 0 hooks registered');
	});
});

