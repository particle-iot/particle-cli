const path = require('path');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_NAME,
	DEVICE_PLATFORM_NAME,
	PATH_PROJ_STROBY_INO,
	PATH_FIXTURES_PROJECTS_DIR
} = require('../lib/env');


describe('Flash Commands [@device]', () => {
	const help = [
		'Send firmware to your device',
		'Usage: particle flash [options] [device|binary] [files...]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --cloud    Flash over the air to the device. Default if no other flag provided  [boolean]',
		'  --usb      Flash over USB using the DFU utility  [boolean]',
		'  --serial   Flash over a virtual serial port  [boolean]',
		'  --factory  Flash user application to the factory reset location. Only available for DFU  [boolean]',
		'  --force    Flash even when binary does not pass pre-flash checks  [boolean]',
		'  --yes      Answer yes to all questions  [boolean]',
		'  --target   The firmware version to compile against. Defaults to latest version, or version on device for cellular.  [string]',
		'  --port     Use this serial port instead of auto-detecting. Useful if there are more than 1 connected device. Only available for serial  [string]',
		'',
		'Examples:',
		'  particle flash red                          Compile the source code in the current directory in the cloud and flash to device red',
		'  particle flash green tinker                 Flash the default Tinker app to device green',
		'  particle flash blue app.ino --target 0.6.3  Compile app.ino in the cloud using the 0.6.3 firmware and flash to device blue',
		'  particle flash cyan firmware.bin            Flash the pre-compiled binary to device cyan',
		'  particle flash --usb firmware.bin           Flash the binary over USB. The device needs to be in DFU mode',
		'  particle flash --serial firmware.bin        Flash the binary over virtual serial port. The device needs to be in listening mode'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'flash']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('flash');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(1); // TODO (mirande): should be 0?
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['flash', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Flashes a project', async () => {
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'stroby');
		const args = ['flash', DEVICE_NAME];
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const log = [
			'Including:',
			'    src/stroby.ino',
			'    project.properties',
			`attempting to flash firmware to your device ${DEVICE_NAME}`,
			'Flash device OK:  Update started'
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await cli.waitForVariable('name', 'stroby');
	});

	// TODO (mirande): need a better way to confirm device is back online after
	// flashing - in this case, the current hackaround doesn't work b/c tinker
	// doesn't expose a `name` variable
	it.skip('FIXME: Flashes a known app', async () => {
		const args = ['flash', DEVICE_NAME, 'tinker'];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			'Including:',
			`    ${PATH_PROJ_STROBY_INO}`,
			`attempting to flash firmware to your device ${DEVICE_NAME}`,
			'Flash device OK:  Update started'
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await cli.waitForVariable('name', 'tinker');
	});

	it('Flashes an `.ino` file', async () => {
		const args = ['flash', DEVICE_NAME, PATH_PROJ_STROBY_INO];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			'Including:',
			`    ${PATH_PROJ_STROBY_INO}`,
			`attempting to flash firmware to your device ${DEVICE_NAME}`,
			'Flash device OK:  Update started'
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await cli.waitForVariable('name', 'stroby');
	});

	it('Flashes a `.bin` file', async () => {
		const { bin } = await cli.compileBlankFirmwareForTest(DEVICE_PLATFORM_NAME);
		const args = ['flash', DEVICE_NAME, bin];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			'Including:',
			`    ${bin}`,
			`attempting to flash firmware to your device ${DEVICE_NAME}`,
			'Flash device OK:  Update started'
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await cli.waitForVariable('name', 'blank');
	});
});

