const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	USERNAME,
	PASSWORD
} = require('../lib/env');


describe('Login Commands', () => {
	const help = [
		'Login to the cloud and store an access token locally',
		'Usage: particle login [options]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  -u, --username  your username  [string]',
		'  -p, --password  your password  [string]',
		'  -t, --token     an existing Particle access token to use  [string]',
		'  --otp           the login code if two-step authentication is enabled  [string]',
		'',
		'Examples:',
		'  particle login                                              prompt for credentials and log in',
		'  particle login --username user@example.com --password test  log in with credentials provided on the command line',
		'  particle login --token <my-api-token>                       log in with an access token provided on the command line'
	];

	before(async () => {
		await cli.logout();
		await cli.setTestProfile();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'login']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['login', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Signs in', async () => {
		const subprocess = cli.run(['login']);

		await delay(1000);
		subprocess.stdin.write(USERNAME);
		subprocess.stdin.write('\n');
		await delay(1000);
		subprocess.stdin.write(PASSWORD);
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(stdout).to.include('Successfully completed login!');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Signs in using `--username` flag', async () => {
		const args = ['login', '--username', USERNAME];
		const subprocess = cli.run(args);

		await delay(1000);
		subprocess.stdin.write('\n');
		await delay(1000);
		subprocess.stdin.write(PASSWORD);
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(stdout).to.include('Successfully completed login!');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Signs in using `--username` and `--password` flags', async () => {
		const args = ['login', '--username', USERNAME, '--password', PASSWORD];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include('Successfully completed login!');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Fails to sign in when username is bad', async () => {
		const subprocess = cli.run(['login']);

		await delay(1000);
		subprocess.stdin.write('watnope@example.com');
		subprocess.stdin.write('\n');
		await delay(1000);
		subprocess.stdin.write(PASSWORD);
		subprocess.stdin.write('\n');
		await delay(1000);
		subprocess.cancel(); // CTRL-C

		const { stdout, stderr, isCanceled } = await subprocess;

		expect(stdout).to.include('There was an error logging you in! Let\'s try again.');
		expect(stderr).to.equal('');
		expect(isCanceled).to.equal(true);
	});

	it('Fails to sign in when password is bad', async () => {
		const subprocess = cli.run(['login']);

		await delay(1000);
		subprocess.stdin.write(USERNAME);
		subprocess.stdin.write('\n');
		await delay(1000);
		subprocess.stdin.write('WATNOPEWATWATNOPENOPE');
		subprocess.stdin.write('\n');
		await delay(1000);
		subprocess.cancel(); // CTRL-C

		const { stdout, stderr, isCanceled } = await subprocess;

		expect(stdout).to.include('There was an error logging you in! Let\'s try again.');
		expect(stderr).to.equal('');
		expect(isCanceled).to.equal(true);
	});

	it('Fails to sign in when `--username` and `--password` flags are bad', async () => {
		const username = 'watnope@example.com';
		const password = 'WATNOPEWATWATNOPENOPE';
		const args = ['login', '--username', username, '--password', password];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include('There was an error logging you in!');
		expect(stdout).to.include('It seems we\'re having trouble with logging in.');
		expect(stderr).to.include('User credentials are invalid');
		expect(exitCode).to.equal(1);
	});
});

