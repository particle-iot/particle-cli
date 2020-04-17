const os = require('os');
const capitalize = require('lodash/capitalize');
const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const stripANSI = require('../lib/ansi-strip');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_NAME,
	PRODUCT_01_ID,
	PRODUCT_01_DEVICE_02_ID,
	PRODUCT_01_DEVICE_02_NAME
} = require('../lib/env');


describe('Variable Commands [@device]', () => {
	const help = [
		'Retrieve and monitor variables on your device',
		'Usage: particle variable <command>',
		'Help:  particle help variable <command>',
		'',
		'Commands:',
		'  list     Show variables provided by your device(s)',
		'  get      Retrieve a value from your device',
		'  monitor  Connect and display messages from a device',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
		await cli.flashStrobyFirmwareOTAForTest();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'variable']);

		expect(stdout).to.equal('');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('variable');

		expect(stdout).to.equal('');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['variable', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('Variable List Subcommand', () => {
		it('Lists all available variables', async () => {
			const platform = capitalize(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(['variable', 'list']);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stdout).to.include('name (string)');
			expect(stdout).to.include('version (int32)');
			expect(stdout).to.include('blinking (int32)');
			expect(stderr).to.include('polling server to see what devices are online, and what variables are available');
			expect(exitCode).to.equal(0);
		});

		it('Lists all available variables (alt)', async () => {
			const platform = capitalize(DEVICE_PLATFORM_NAME);
			const { stdout, stderr, exitCode } = await cli.run(['variable', 'get']);

			expect(stdout).to.include(`${DEVICE_NAME} [${DEVICE_ID}] (${platform})`);
			expect(stdout).to.include('name (string)');
			expect(stdout).to.include('version (int32)');
			expect(stdout).to.include('blinking (int32)');
			expect(stderr).to.include('polling server to see what devices are online, and what variables are available');
			expect(exitCode).to.equal(0);
		});

		it('Lists variables available on device and prompts to pick', async () => {
			const subprocess = cli.run(['variable', 'get', DEVICE_ID]);

			await delay(1000);
			subprocess.stdin.end(os.EOL);

			const { stdout, stderr, exitCode } = await subprocess;
			const log = stripANSI(stdout);

			expect(log).to.include('Which variable did you want?');
			expect(log).to.include(`name (string)${os.EOL}stroby`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});

	describe('Variable Get Subcommand', () => {
		const help = [
			'Retrieve a value from your device',
			'Usage: particle get [options] [device] [variableName]',
			'',
			'Global Options:',
			'  -v, --verbose  Increases how much logging to display  [count]',
			'  -q, --quiet    Decreases how much logging to display  [count]',
			'',
			'Options:',
			'  --time     Show the time when the variable was received  [boolean]',
			'  --product  Target a device within the given Product ID or Slug  [string]',
			'',
			'Examples:',
			'  particle get basement temperature                                  Read the `temperature` variable from the device `basement`',
			'  particle get 0123456789abcdef01234567 temperature --product 12345  Read the `temperature` variable from the device with id `0123456789abcdef01234567` within product `12345`',
			'  particle get all temperature                                       Read the `temperature` variable from all my devices'
		];

		it('Gets a variable by name', async () => {
			const args = ['get', DEVICE_ID, 'version'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('42');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Gets a variable by name with timestamp', async () => {
			const args = ['variable', 'get', DEVICE_ID, 'version', '--time'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const [timestamp, version] = stdout.split(', ');

			expect(timestamp.split(':')).to.have.lengthOf(4);
			expect(version).to.equal('42');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Uses default when `--delay` is too short', async () => {
			const args = ['variable', 'monitor', DEVICE_ID, 'version', '--delay', 1];
			const subprocess = cli.run(args);
			const received = [];

			await waitForResult(subprocess, (data) => {
				const log = data.toString('utf8').trim();

				received.push(log);

				if (received.length > 3){
					return true;
				}
				return false;
			});

			const { isCanceled } = await subprocess;
			const [alert, msg, ...results] = received;

			expect(alert).to.equal('Delay was too short, resetting to 500ms');
			expect(msg).to.equal('Hit CTRL-C to stop!');
			expect(results).to.have.lengthOf.above(1);
			expect(isCanceled).to.equal(true);
		});

		// TODO (mirande): need to ensure device is running expected firmware and online
		// once flashing product devices is implemented - as it is, the expectation
		// is that your product device is running the `stroby` firmware found in:
		// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
		it('Gets a variable from a product device by name', async () => {
			const args = ['get', PRODUCT_01_DEVICE_02_ID, 'version', '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout.slice(-2)).to.equal('42');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to get an unknown variable', async () => {
			const args = ['get', DEVICE_NAME, 'NOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const msg = [
				'Error: Unknown Variable: NOPE',
				'Error while reading value: Some variables could not be read'
			].join(os.EOL);

			expect(stdout).to.include(msg);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to get a variable from a product device when `device` param is not provided', async () => {
			const args = ['get', '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('`device` parameter is required when `--product` flag is set');
			expect(stderr.split(os.EOL)).to.include.members(help);
			expect(exitCode).to.equal(1);
		});

		it('Fails to get a variable from a product device when `device` param is not an id', async () => {
			const args = ['get', PRODUCT_01_DEVICE_02_NAME, 'version', '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`\`device\` must be an id when \`--product\` flag is set - received: ${PRODUCT_01_DEVICE_02_NAME}`);
			expect(stderr.split(os.EOL)).to.include.members(help);
			expect(exitCode).to.equal(1);
		});

		it('Fails to get a variable from a product device when `variableName` param is not provided', async () => {
			const args = ['get', PRODUCT_01_DEVICE_02_ID, '--product', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`\`variableName\` parameter is required when \`--product\` flag is set. To view available variables, run: particle product device list ${PRODUCT_01_ID}`);
			expect(stderr.split(os.EOL)).to.include.members(help);
			expect(exitCode).to.equal(1);
		});
	});

	describe('Variable Monitor Subcommand', () => {
		it('Monitors a variable', async () => {
			const args = ['variable', 'monitor', DEVICE_ID, 'version', '--delay', 1000];
			const subprocess = cli.run(args);
			const received = [];

			await waitForResult(subprocess, (data) => {
				const log = data.toString('utf8').trim();

				received.push(log);

				if (received.length > 3){
					return true;
				}
				return false;
			});

			const { isCanceled } = await subprocess;
			const [msg, ...results] = received;

			expect(msg).to.equal('Hit CTRL-C to stop!');
			expect(results).to.have.lengthOf.above(2);
			expect(isCanceled).to.equal(true);
		});
	});

	function waitForResult(subprocess, isFinished){
		return new Promise((resolve, reject) => {
			subprocess.all.on('data', (data) => {
				if (isFinished(data)){
					subprocess.cancel();
					resolve();
				}
			});
			subprocess.all.on('error', (error) => {
				subprocess.cancel();
				reject(error);
			});
			subprocess.all.on('close', () => {
				subprocess.cancel();
				resolve();
			});
		});
	}
});

