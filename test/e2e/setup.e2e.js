const { expect } = require('../setup');
const cli = require('../lib/cli');


describe('Setup Commands [@device]', () => {
	const help = [
		'Do the initial setup & claiming of your device',
		'Usage: particle setup [options]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --wifi    Force setup over WiFi even if a device is connected to USB  [boolean]',
		'  --scan    Force WiFi scanning  [boolean]',
		'  --manual  Force no WiFi scannign  [boolean]',
		'  --yes     Answer yes to all questions  [boolean]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

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

	it.skip('NYI', async () => {});
});

