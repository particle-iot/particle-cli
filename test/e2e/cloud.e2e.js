const os = require('os');
const path = require('path');
const capitalize = require('lodash/capitalize');
const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const stripANSI = require('../lib/ansi-strip');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_NAME,
	FOREIGN_DEVICE_ID,
	PRODUCT_01_ID,
	PRODUCT_01_DEVICE_01_ID,
	PRODUCT_01_DEVICE_01_NAME,
	PATH_TMP_DIR,
	PATH_PROJ_BLANK_INO,
	PATH_PROJ_STROBY_INO,
	PATH_FIXTURES_PROJECTS_DIR
} = require('../lib/env');


describe('Cloud Commands [@device]', () => {
	const strobyBinPath = path.join(PATH_TMP_DIR, 'photon-stroby.bin');
	const help = [
		'Access Particle cloud functionality',
		'Usage: particle cloud <command>',
		'Help:  particle help cloud <command>',
		'',
		'Commands:',
		'  claim    Register a device with your user account with the cloud',
		'  list     Display a list of your devices, as well as their variables and functions',
		'  remove   Release a device from your account so that another user may claim it',
		'  name     Give a device a name!',
		'  flash    Pass a binary, source file, or source directory to a device!',
		'  compile  Compile a source file, or directory using the cloud compiler',
		'  nyan     Make your device shout rainbows',
		'  login    Login to the cloud and store an access token locally',
		'  logout   Log out of your session and clear your saved access token',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
		await cli.flashBlankFirmwareOTAForTest();
	});

	afterEach(async () => {
		await cli.claimTestDevice();
		await cli.revertDeviceName();
	});

	after(async () => {
		await Promise.all(
			[DEVICE_ID, PRODUCT_01_DEVICE_01_ID]
				.map(id => cli.run(['cloud', 'nyan', id, 'off'], { reject: true }))
		);
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'cloud']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('cloud');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['cloud', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('Cloud List Subcommand', () => {
		const platform = capitalize(DEVICE_PLATFORM_NAME);
		let args;

		beforeEach(async () => {
			args = ['cloud', 'list'];
		});

		it('Lists devices', async () => {
			const args = ['cloud', 'list'];
			const platform = capitalize(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices filtered by platform name', async () => {
			args.push(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices filtered by platform name omitting test device', async () => {
			const { knownPlatformIds } = require('../../src/lib/utilities');
			const platformNames = Object.keys(knownPlatformIds());
			// Derive platform name NOT matching those claimed by E2E test profile
			// (i.e. find single, valid inversion of DEVICE_PLATFORM_NAME)
			const nonE2EDevicePlatform = platformNames.filter(name => name !== DEVICE_PLATFORM_NAME);

			args.push(nonE2EDevicePlatform);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.not.include(DEVICE_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices filtered by device name', async () => {
			args.push(DEVICE_NAME);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices filtered by device name omitting test device', async () => {
			args.push('non-existent-device-name');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.not.include(DEVICE_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices filtered by device id', async () => {
			args.push(DEVICE_ID);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices filtered by device id omitting test device', async () => {
			args.push('non-existent-device-id');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.not.include(DEVICE_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices filtered by `online` state', async () => {
			args.push('online');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists connected devices filtered by `offline` state', async () => {
			args.push('offline');
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.not.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});

	describe('Cloud Compile Subcommand', () => {
		it('Compiles firmware', async () => {
			const args = ['cloud', 'compile', 'photon', PATH_PROJ_STROBY_INO, '--saveTo', strobyBinPath];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				'Compiling code for photon',
				'',
				'Including:',
				`    ${PATH_PROJ_STROBY_INO}`,
				'',
				'Compile succeeded.',
				'',
				'Memory use:',
				'', // don't assert against memory stats since they may change based on current default Device OS version
				`Saved firmware to: ${strobyBinPath}`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Compiles a project with symlinks to parent/other file locations', async () => {
			const name = 'symlinks';
			const platform = 'photon';
			const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'symlink', 'main-project');
			const destination = path.join(PATH_TMP_DIR, `${name}-${platform}.bin`);
			const args = ['cloud', 'compile', platform, '--saveTo', destination, '--followSymlinks'];
			const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
			const log = [
				`Compiling code for ${platform}`,
				'Including:',
				'    shared/sub_dir/helper.h',
				'    app.ino',
				'    shared/sub_dir/helper.cpp',
				'    project.properties',
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});

	describe('Cloud Flash Subcommand', () => {
		const help = [
			'Pass a binary, source file, or source directory to a device!',
			'Usage: particle cloud flash [options] <device> [files...]',
			'',
			'Global Options:',
			'  -v, --verbose  Increases how much logging to display  [count]',
			'  -q, --quiet    Decreases how much logging to display  [count]',
			'',
			'Options:',
			'  --target          The firmware version to compile against. Defaults to latest version, or version on device for cellular.  [string]',
			'  --followSymlinks  Follow symlinks when collecting files  [boolean]',
			'  --product         Target a device within the given Product ID or Slug  [string]',
			'',
			'Examples:',
			'  particle cloud flash blue                                      Compile the source code in the current directory in the cloud and flash to device `blue`',
			'  particle cloud flash green tinker                              Flash the default `tinker` app to device `green`',
			'  particle cloud flash red blink.ino                             Compile `blink.ino` in the cloud and flash to device `red`',
			'  particle cloud flash orange firmware.bin                       Flash a pre-compiled `firmware.bin` binary to device `orange`',
			'  particle cloud flash 0123456789abcdef01234567 --product 12345  Compile the source code in the current directory in the cloud and flash to device `0123456789abcdef01234567` within product `12345`',
		];

		it('Flashes firmware', async () => {
			const args = ['cloud', 'flash', DEVICE_NAME, PATH_PROJ_STROBY_INO];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Compiling code for ${DEVICE_NAME}`,
				'',
				'Including:',
				`    ${PATH_PROJ_STROBY_INO}`,
				'',
				'Compile succeeded.',
				'',
				'Memory use:',
				'', // don't assert against memory stats since they may change based on current default Device OS version
				`Flashing firmware to your device ${DEVICE_NAME}`,
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await cli.waitForVariable('name', 'stroby');
		});

		it('Flashes a project with symlinks to parent/other file locations', async () => {
			const cwd = path.join(PATH_FIXTURES_PROJECTS_DIR, 'symlink', 'main-project');
			const args = ['cloud', 'flash', DEVICE_NAME, '--followSymlinks'];
			const { stdout, stderr, exitCode } = await cli.run(args, { cwd });
			const log = [
				'Including:',
				'    shared/sub_dir/helper.h',
				'    app.ino',
				'    shared/sub_dir/helper.cpp',
				'    project.properties',
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await delay(40 * 1000); // TODO (mirande): replace w/ `cli.waitForDeviceToGetOnline()` helper
		});

		it('Flashes a product device', async () => {
			const args = ['cloud', 'flash', PRODUCT_01_DEVICE_01_ID, PATH_PROJ_BLANK_INO, '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Compiling code for ${PRODUCT_01_DEVICE_01_ID}`,
				`Marking device ${PRODUCT_01_DEVICE_01_ID} as a development device`,
				`Flashing firmware to your device ${PRODUCT_01_DEVICE_01_ID}`,
				`Device ${PRODUCT_01_DEVICE_01_ID} is now marked as a developement device and will NOT receive automatic product firmware updates.`,
				'To resume normal updates, please visit:',
				`https://console.particle.io/${PRODUCT_01_ID}/devices/unmark-development/${PRODUCT_01_DEVICE_01_ID}`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await delay(40 * 1000); // TODO (mirande): replace w/ `cli.waitForProductVariable()` helper
		});

		it('Flashes a `known app` on to a product device', async () => {
			const args = ['cloud', 'flash', PRODUCT_01_DEVICE_01_ID, 'tinker', '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Marking device ${PRODUCT_01_DEVICE_01_ID} as a development device`,
				`Flashing firmware to your device ${PRODUCT_01_DEVICE_01_ID}`,
				`Device ${PRODUCT_01_DEVICE_01_ID} is now marked as a developement device and will NOT receive automatic product firmware updates.`,
				'To resume normal updates, please visit:',
				`https://console.particle.io/${PRODUCT_01_ID}/devices/unmark-development/${PRODUCT_01_DEVICE_01_ID}`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await delay(40 * 1000); // TODO (mirande): replace w/ `cli.waitForProductFunction()` helper
		});

		it('Flashes a `known app` on to a product device using legacy command', async () => {
			const args = ['flash', PRODUCT_01_DEVICE_01_NAME, 'tinker'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Marking device ${PRODUCT_01_DEVICE_01_ID} as a development device`,
				`Flashing firmware to your device ${PRODUCT_01_DEVICE_01_ID}`,
				`Device ${PRODUCT_01_DEVICE_01_ID} is now marked as a developement device and will NOT receive automatic product firmware updates.`,
				'To resume normal updates, please visit:',
				`https://console.particle.io/${PRODUCT_01_ID}/devices/unmark-development/${PRODUCT_01_DEVICE_01_ID}`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);

			await delay(40 * 1000); // TODO (mirande): replace w/ `cli.waitForProductFunction()` helper
		});

		it('Fails to flash a product device when `device` param is not an id', async () => {
			const args = ['cloud', 'flash', PRODUCT_01_DEVICE_01_NAME, PATH_PROJ_BLANK_INO, '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`\`device\` must be an id when \`--product\` flag is set - received: ${PRODUCT_01_DEVICE_01_NAME}`);
			expect(stderr.split(os.EOL)).to.include.members(help);
			expect(exitCode).to.equal(1);
		});
	});

	describe('Cloud Remove Subcommand', () => {
		afterEach(async () => {
			await cli.run(['cloud', 'claim', DEVICE_ID], { reject: true });
			await delay(5000);
		});

		it('Removes device', async () => {
			const args = ['cloud', 'remove', DEVICE_NAME, '--yes'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`releasing device ${DEVICE_NAME}`,
				'Okay!'
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});

	describe('Cloud Claim Subcommand', () => {
		// TODO (mirande): unclaim beforeEach..?
		it('Claims device', async () => {
			const id = DEVICE_ID.toLowerCase();
			const args = ['cloud', 'claim', id];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Claiming device ${id}`,
				`Successfully claimed device ${id}`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Claims device when device id is capitalized', async () => {
			const id = DEVICE_ID.toUpperCase();
			const args = ['cloud', 'claim', id];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Claiming device ${id}`,
				`Successfully claimed device ${id}`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to claim an unknown device', async () => {
			const invalidDeviceID = '1234567890';
			const args = ['cloud', 'claim', invalidDeviceID];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Claiming device ${invalidDeviceID}`,
				'Failed to claim device: device not found'
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to claim a device owned by someone else', async () => {
			const args = ['cloud', 'claim', FOREIGN_DEVICE_ID];
			const subprocess = cli.run(args);

			await delay(1000);
			subprocess.stdin.write('n');
			subprocess.stdin.write('\n');

			const { all, exitCode } = await subprocess;
			const log = stripANSI(all);

			expect(log).to.include(`Claiming device ${FOREIGN_DEVICE_ID}`);
			expect(log).to.include('That device belongs to someone else. Would you like to request a transfer?');
			expect(log).to.include('Failed to claim device: You cannot claim a device owned by someone else');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Cloud Name Subcommand', () => {
		afterEach(async () => {
			await cli.revertDeviceName();
		});

		it('Names a device', async () => {
			const name = `${DEVICE_NAME}-updated`;
			const args = ['cloud', 'name', DEVICE_ID, name];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Renaming device ${DEVICE_ID}`,
				`Successfully renamed device ${DEVICE_ID} to: ${name}`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to name an unknown device', async () => {
			const invalidDeviceID = '1234567890';
			const args = ['cloud', 'name', invalidDeviceID, 'NOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Renaming device ${invalidDeviceID}`,
				`Failed to rename ${invalidDeviceID}: Permission Denied`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to name a device owned by someone else', async () => {
			const args = ['cloud', 'name', FOREIGN_DEVICE_ID, 'NOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const log = [
				`Renaming device ${FOREIGN_DEVICE_ID}`,
				`Failed to rename ${FOREIGN_DEVICE_ID}: Permission Denied`
			];

			expect(stdout.split('\n')).to.include.members(log);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Cloud Nyan Subcommand', () => {
		const help = [
			'Make your device shout rainbows',
			'Usage: particle cloud nyan [options] <device> [onOff]',
			'',
			'Global Options:',
			'  -v, --verbose  Increases how much logging to display  [count]',
			'  -q, --quiet    Decreases how much logging to display  [count]',
			'',
			'Options:',
			'  --product  Target a device within the given Product ID or Slug  [string]',
			'',
			'Examples:',
			'  particle cloud nyan blue                  Make the device named `blue` start signaling',
			'  particle cloud nyan blue off              Make the device named `blue` stop signaling',
			'  particle cloud nyan blue --product 12345  Make the device named `blue` within product `12345` start signaling',
		];

		it('Starts a device signaling', async () => {
			const args = ['cloud', 'nyan', DEVICE_NAME];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Stops a device signaling', async () => {
			const args = ['cloud', 'nyan', DEVICE_NAME, 'off'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Starts a product device signaling', async () => {
			const args = ['cloud', 'nyan', PRODUCT_01_DEVICE_01_ID, '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Stops a product device signaling', async () => {
			const args = ['cloud', 'nyan', PRODUCT_01_DEVICE_01_ID, 'off', '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to start a product device signaling when `device` param is not an id', async () => {
			const args = ['cloud', 'nyan', PRODUCT_01_DEVICE_01_NAME, '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`\`device\` must be an id when \`--product\` flag is set - received: ${PRODUCT_01_DEVICE_01_NAME}`);
			expect(stderr.split(os.EOL)).to.include.members(help);
			expect(exitCode).to.equal(1);
		});
	});
});

