const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const matches = require('../lib/capture-matches');
const stripANSI = require('../lib/ansi-strip');
const cli = require('../lib/cli');
const {
	PASSWORD
} = require('../lib/env');


describe('Token Commands', () => {
	const help = [
		'Manage access tokens (require username/password)',
		'Usage: particle token <command>',
		'Help:  particle help token <command>',
		'',
		'Commands:',
		'  list    List all access tokens for your account',
		'  revoke  Revoke an access token',
		'  create  Create a new access token',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'token']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('token');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['token', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Creates a token', async () => {
		const subprocess = cli.run(['token', 'create']);

		await delay(1000);
		subprocess.stdin.write(PASSWORD);
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;
		const [msg, token] = stripANSI(stdout).split('\n').slice(-2).map(t => t.trim());

		expect(msg).to.include('New access token expires on');
		expect(token).to.be.a('string').with.lengthOf.at.least(12);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Revokes a token', async () => {
		let subprocess = cli.run(['token', 'create'], { reject: true });

		await delay(1000);
		subprocess.stdin.write(PASSWORD);
		subprocess.stdin.end('\n');

		const { stdout: log } = await subprocess;
		const [, token] = stripANSI(log).split('\n').slice(-2).map(t => t.trim());

		expect(token).to.be.a('string').with.lengthOf.at.least(12);

		subprocess = cli.run(['token', 'revoke', token]);

		await delay(1000);
		subprocess.stdin.write(PASSWORD);
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;
		const [msg] = stripANSI(stdout).split('\n').slice(-1).map(t => t.trim());

		expect(msg).to.include(`successfully deleted ${token}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Lists tokens', async () => {
		const subprocess = cli.run(['token', 'list']);

		await delay(1000);
		subprocess.stdin.write(PASSWORD);
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;
		const tokens = matches(stripANSI(stdout), / Token:\s{6}(.*)/g);

		expect(tokens).to.have.lengthOf.at.least(3);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		// TODO (mirande): always revoke all tokens upon completion?
		// await tokens.reduce((promise, t) => {
		// 	return promise.then(() => {
		// 		console.log('REVOKING:', t);
		// 		return cli.run(['token', 'revoke', t], { input: PASSWORD });
		// 	});
		// }, Promise.resolve());
	});
});

