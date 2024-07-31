const path = require('path');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_NAME,
	PATH_PROJ_STROBY_INO,
	PATH_FIXTURES_PROJECTS_DIR,
	PATH_FIXTURES_BINARIES_DIR
} = require('../lib/env');
const { delay } = require('../lib/mocha-utils');
const stripAnsi = require('strip-ansi');


describe('Flash Commands for Protected Devices [@device]', () => {
	const help = [
		'Send firmware to your device',
		'Usage: particle flash [options] [device|binary] [files...]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --cloud             Flash over the air to the device. Default if no other flag provided  [boolean]',
		'  --local             Flash locally, updating Device OS as needed  [boolean]',
		'  --usb               Flash a single file over USB  [boolean]',
		'  --serial            DEPRECATED. Use --local instead  [boolean]',
		'  --factory           Flash user application to the factory reset location. Only available for USB flash  [boolean]',
		'  --yes               Answer yes to all questions  [boolean]',
		'  --target            The firmware version to compile against. Defaults to latest version.  [string]',
		'  --application-only  Do not update Device OS when flashing locally  [boolean]',
		'  --port              Use this serial port instead of auto-detecting. Useful if there are more than 1 connected device. Only available for serial  [string]',
		'',
		'Examples:',
		'  particle flash red                                 Compile the source code in the current directory in the cloud and flash to device red',
		'  particle flash green tinker                        Flash the default Tinker app to device green',
		'  particle flash blue app.ino --target 5.0.0         Compile app.ino in the cloud using the 5.0.0 firmware and flash to device blue',
		'  particle flash cyan firmware.bin                   Flash the pre-compiled binary to device cyan',
		'  particle flash --local                             Compile the source code in the current directory in the cloud and flash to the device connected over USB',
		'  particle flash --local <deviceId> application.bin  Compile the source code in the current directory in the cloud and flash to the device connected over USB',
		'  particle flash --local --target 5.0.0              Compile the source code in the current directory in the cloud against the target version and flash to the device connected over USB',
		'  particle flash --local application.bin             Flash the pre-compiled binary to the device connected over USB',
		'  particle flash --local application.zip             Flash the pre-compiled binary and assets from the bundle to the device connected over USB',
		'  particle flash --local tinker                      Flash the default Tinker app to the device connected over USB',
		'  particle flash --usb firmware.bin                  Flash the binary over USB',
		'',
		'When passing the --local flag, Device OS will be updated if the version on the device is outdated.',
		'When passing both the --local and --target flash, Device OS will be updated to the target version.',
		'To avoid this behavior, pass the --application-only flag.'
	];

	const argsDp = ['device-protection', 'status'];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.resetDevice();
		await delay(5000);
		await cli.waitUntilOnline();
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

		expect(stdout).to.equal('You must specify a device or a file');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(1); // TODO (mirande): should be 0?
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['flash', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	// Comment to self. Remove later.
	// As long as the device is in a Protected product, cloud will not send OTAs down to the device
	// even if the device is in Service Mode. So cloud flashes will not work.
	// Cloud flashes will work if the device is marked as a development device, at which point, cloud turns the
	// Protected Device to an Open Device by sending down the OG bootloader (which is the non-protected one).
	it('Fails to flash a project over cloud', async () => {
		const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'stroby');
		const args = ['flash', DEVICE_NAME];
		const { stdout: stdoutPBefore } = await cli.run(argsDp);
		const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
		const { stdout: stdoutPAfter } = await cli.run(argsDp);
		const log = [
			'Including:',
			'    project.properties',
			'    src/stroby.ino',
			'',
			'Compile succeeded.',
			'',
			`Flashing firmware to your device ${DEVICE_NAME}`,
			`Failed to flash ${DEVICE_NAME}: Update denied - device protection active`
		];

		expect(stripAnsi(stdout).split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
		expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
		expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
	});

	it('Fails to flash an `.ino` file over cloud', async () => {
		const args = ['flash', DEVICE_NAME, PATH_PROJ_STROBY_INO];
		const log = [
			`Failed to flash ${DEVICE_NAME}: Update denied - device protection active`
		];

		const { stdout: stdoutPBefore } = await cli.run(argsDp);
		const { stdout, stderr, exitCode } = await cli.run(args);
		const { stdout: stdoutPAfter } = await cli.run(argsDp);

		expect(stripAnsi(stdout).split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
		expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
		expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
	});

	it('Flashes a `.bin` file over usb', async () => {
		await cli.waitUntilOnline();
		const filename = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon-tinker-620.bin');
		const args = ['flash', '--usb', filename];
		const log = [
			`Flashing ${DEVICE_PLATFORM_NAME} device ${DEVICE_ID}`,
			'Flashing invalidate-128k-user-part',
			'Flashing argon-tinker-620.bin',
			'Flash success!'
		];

		const { stdout: stdoutPBefore } = await cli.run(argsDp);
		await cli.enterDFUMode();
		const { stdout, stderr, exitCode } = await cli.run(args);
		const { stdout: stdoutPAfter } = await cli.run(argsDp);

		expect(stripAnsi(stdout).split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
		expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
		expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');

		await cli.resetDevice();
		await delay(5000);
	});

	it('Fails to flash missing or unrecognized app over cloud', async () => {
		const args = ['flash', DEVICE_NAME, 'WATNOPE.bin'];
		const log = [
			`Failed to flash ${DEVICE_NAME}: I couldn't find that file: WATNOPE.bin`
		];

		const { stdout: stdoutPBefore } = await cli.run(argsDp);
		const { stdout, stderr, exitCode } = await cli.run(args);
		const { stdout: stdoutPAfter } = await cli.run(argsDp);

		expect(stripAnsi(stdout).split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
		expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
		expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');
	});

	it('Fails to flash missing or unrecognized app when over usb', async () => {
		await cli.enterDFUMode();
		const args = ['flash', 'WATNOPE.bin', '--usb'];
		const log = [
			'Error: WATNOPE.bin doesn\'t exist'
		];

		const { stdout: stdoutPBefore } = await cli.run(argsDp);
		const { stdout, stderr, exitCode } = await cli.run(args);
		const { stdout: stdoutPAfter } = await cli.run(argsDp);

		expect(stripAnsi(stdout).split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
		expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
		expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');

		await cli.resetDevice();
		await delay(5000);
	});

	it('Flashes a file locally in dfu mode', async () => {
		await cli.waitUntilOnline();
		const filename = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon-tinker-620.bin');	// FIXME
		const args = ['flash', '--local', filename, '--application-only'];
		const log = [
			'Flashing invalidate-128k-user-part',
			'Flash success!'
		];

		const { stdout: stdoutPBefore } = await cli.run(argsDp);
		await cli.enterDFUMode();
		const { stdout, stderr, exitCode } = await cli.run(args);
		const { stdout: stdoutPAfter } = await cli.run(argsDp);

		expect(stripAnsi(stdout).split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
		expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
		expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');

		await cli.resetDevice();
		await delay(5000);
	});

	it('Flashes a file locally in normal mode', async () => {
		await cli.waitUntilOnline();
		const filename = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon-bootloader-620.bin');	// FIXME
		const args = ['flash', '--local', filename, '--application-only'];
		const log = [
			'Flashing argon-bootloader-620.bin',
			'Flash success!'
		];

		const { stdout: stdoutPBefore } = await cli.run(argsDp);
		const { stdout, stderr, exitCode } = await cli.run(args);
		const { stdout: stdoutPAfter } = await cli.run(argsDp);

		expect(stripAnsi(stdout).split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
		expect((stdoutPBefore.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPBefore.split('\n'))[0]).to.not.include('Service Mode');
		expect((stdoutPAfter.split('\n'))[0]).to.include('Protected Device');
		expect((stdoutPAfter.split('\n'))[0]).to.not.include('Service Mode');

		await cli.resetDevice();
		await delay(5000);
	});
});
