const os = require('os');
const path = require('path');
const { expect } = require('../setup');
const capitalize = require('lodash/capitalize');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	PATH_TMP_DIR,
	PRODUCT_01_ID,
	PRODUCT_01_NAME,
	PRODUCT_01_DEVICE_01_ID,
	PRODUCT_01_DEVICE_01_NAME,
	PRODUCT_01_DEVICE_01_PLATFORM_NAME,
	PRODUCT_01_DEVICE_02_ID,
	PRODUCT_01_DEVICE_02_NAME,
	PRODUCT_01_DEVICE_02_GROUP,
} = require('../lib/env');


describe('Product Commands', () => {
	const help = [
		'Access Particle Product functionality',
		'Usage: particle product <command>',
		'Help:  particle help product <command>',
		'',
		'Commands:',
		'  device  Manage the devices associated with your product',
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
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'product']);
		expect(stdout).to.equal('');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('product');
		expect(stdout).to.equal('');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['product', '--help']);
		expect(stdout).to.equal('');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('List Subcommand', () => {
		const productFieldNames = ['id', 'name', 'slug', 'description',
			'platform_id', 'subscription_id', 'mb_limit', 'groups', 'settings'];

		before(async () => {
			await cli.setTestProfileAndLogin();
		});

		it('Lists products', async () => {
			const args = ['product', 'list'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`${PRODUCT_01_NAME} [${PRODUCT_01_ID}] (${capitalize(PRODUCT_01_DEVICE_01_PLATFORM_NAME)})`);
			expect(stdout).to.include('  Description:');
			expect(stdout).to.include('  Groups:');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		// TODO (mirande): device's `id` field should probably be a string
		it('Lists products using the `--json` flag', async () => {
			const args = ['product', 'list', '--json'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const json = parseAndSortProductList(stdout);

			expect(json).to.have.all.keys('meta', 'data');
			expect(json.meta).to.have.all.keys('version');
			expect(json.meta.version).to.equal('1.0.0');
			expect(json.data).to.have.lengthOf.at.least(1);
			expect(json.data[0]).to.include.keys(productFieldNames);
			expect(`${json.data[0].id}`).to.equal(PRODUCT_01_ID);
			expect(json.data[0].name).to.equal(PRODUCT_01_NAME);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to list products when user is signed-out', async () => {
			await cli.logout();

			const args = ['product', 'list'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('HTTP error 400');
			expect(stdout).to.include('The access token was not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to list products when user is signed-out and using the `--json` flag', async () => {
			await cli.logout();

			const args = ['product', 'list', '--json'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const json = parseAndSortProductList(stdout);

			expect(json).to.be.an('object');
			expect(json).to.have.all.keys('meta', 'error');
			expect(json.meta).to.have.all.keys('version');
			expect(json.meta.version).to.equal('1.0.0');
			expect(json.error).to.have.property('message').that.is.a('string');
			expect(json.error.message).include('HTTP error 400');
			expect(json.error.message).include('The access token was not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Device List Subcommand', () => {
		// TODO (mirande): sometimes entity includes: `desired_firmware_version`
		const summaryDeviceFieldNames = ['denied',
			'development', 'firmware_product_id', 'groups', 'iccid', 'id', 'imei',
			'last_handshake_at', 'last_iccid', 'last_ip_address', 'name', 'notes',
			'online', 'owner', 'platform_id', 'product_id', 'quarantined',
			'serial_number', 'system_firmware_version',
			'targeted_firmware_release_version', 'user_id'];

		// TODO (mirande): sometimes entity includes: `pinned_build_target`
		const detailedDeviceFieldNames = ['cellular', 'connected',
			'current_build_target', 'default_build_target', 'functions', 'groups',
			'iccid', 'id', 'imei', 'last_app', 'last_heard', 'last_iccid',
			'last_ip_address', 'mobile_secret', 'name', 'notes', 'platform_id',
			'product_id', 'serial_number', 'status', 'system_firmware_version',
			'targeted_firmware_release_version', 'variables'];

		before(async () => {
			await cli.setTestProfileAndLogin();
		});

		it('Lists devices', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);
			expect(stdout).to.include(`${PRODUCT_01_DEVICE_01_NAME} [${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID})`);
			expect(stdout).to.include(`${PRODUCT_01_DEVICE_02_NAME} [${PRODUCT_01_DEVICE_02_ID}] (Product ${PRODUCT_01_ID})`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices using the `--name` flag', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID, '--name', PRODUCT_01_DEVICE_02_NAME];
			const { stdout, stderr, exitCode } = await cli.run(args);
			expect(stdout).to.include(`${PRODUCT_01_DEVICE_02_NAME} [${PRODUCT_01_DEVICE_02_ID}] (Product ${PRODUCT_01_ID})`);
			expect(stdout.split(os.EOL)).to.have.lengthOf(1);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices using the `--limit` flag', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID, '--limit', 1];
			const { stdout, stderr, exitCode } = await cli.run(args);
			expect(stdout).to.include(`(Product ${PRODUCT_01_ID})`);
			expect(stdout.split(os.EOL)).to.have.lengthOf(1);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists devices using the `--groups` flag', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID, '--groups', PRODUCT_01_DEVICE_02_GROUP];
			const { stdout, stderr, exitCode } = await cli.run(args);
			expect(stdout).to.include(`${PRODUCT_01_DEVICE_02_NAME} [${PRODUCT_01_DEVICE_02_ID}] (Product ${PRODUCT_01_ID})`);
			expect(stdout.split(os.EOL)).to.have.lengthOf(1);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		// TODO (mirande): device's `product_id` field should probably be a string
		it('Lists devices using the `--json` flag', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID, '--json'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const json = parseAndSortDeviceList(stdout);

			expect(json).to.have.all.keys('meta', 'data');
			expect(json.meta).to.have.all.keys('version', 'current', 'next', 'previous');
			expect(json.meta.version).to.equal('1.0.0');
			expect(json.data).to.have.lengthOf.at.least(2);
			expect(json.data[0]).to.include.keys(summaryDeviceFieldNames);
			expect(json.data[0].id).to.equal(PRODUCT_01_DEVICE_01_ID);
			expect(json.data[0].name).to.equal(PRODUCT_01_DEVICE_01_NAME);
			expect(`${json.data[0].product_id}`).to.equal(PRODUCT_01_ID);
			expect(json.data[1]).to.include.keys(summaryDeviceFieldNames);
			expect(json.data[1].id).to.equal(PRODUCT_01_DEVICE_02_ID);
			expect(json.data[1].name).to.equal(PRODUCT_01_DEVICE_02_NAME);
			expect(`${json.data[1].product_id}`).to.equal(PRODUCT_01_ID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Shows device detail', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID, PRODUCT_01_DEVICE_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);
			expect(stdout).to.include(`${PRODUCT_01_DEVICE_01_NAME} [${PRODUCT_01_DEVICE_01_ID}] (Product ${PRODUCT_01_ID})`);
			expect(stdout).to.include('Functions:');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Shows device detail using the `--json` flag', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID, PRODUCT_01_DEVICE_01_ID, '--json'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const json = JSON.parse(stdout);

			expect(json).to.have.all.keys('meta', 'data');
			expect(json.meta).to.have.all.keys('version');
			expect(json.meta.version).to.equal('1.0.0');
			expect(json.data).to.be.an('object');
			expect(json.data).to.include.keys(detailedDeviceFieldNames);
			expect(json.data.id).to.equal(PRODUCT_01_DEVICE_01_ID);
			expect(json.data.name).to.equal(PRODUCT_01_DEVICE_01_NAME);
			expect(`${json.data.product_id}`).to.equal(PRODUCT_01_ID);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to list devices when `product` is unknown', async () => {
			const args = ['product', 'device', 'list', 'LOLWUTNOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('HTTP error 404');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to list devices when `product` is unknown using the `--json` flag', async () => {
			const args = ['product', 'device', 'list', 'LOLWUTNOPE', '--json'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const json = parseAndSortDeviceList(stdout);

			expect(json).to.be.an('object');
			expect(json).to.have.all.keys('meta', 'error');
			expect(json.meta).to.have.all.keys('version');
			expect(json.meta.version).to.equal('1.0.0');
			expect(json.error).to.have.property('message').that.is.a('string');
			expect(json.error.message).include('HTTP error 404');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to show device detail when `device` is unknown', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID, 'LOLWUTNOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('HTTP error 404');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to show device detail when `device` is unknown using the `--json` flag', async () => {
			const args = ['product', 'device', 'list', PRODUCT_01_ID, 'LOLWUTNOPE', '--json'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const json = parseAndSortDeviceList(stdout);

			expect(json).to.be.an('object');
			expect(json).to.have.all.keys('meta', 'error');
			expect(json.meta).to.have.all.keys('version');
			expect(json.meta.version).to.equal('1.0.0');
			expect(json.error).to.have.property('message').that.is.a('string');
			expect(json.error.message).include('HTTP error 404');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to list devices when user is signed-out', async () => {
			await cli.logout();

			const args = ['product', 'device', 'list', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('HTTP error 400');
			expect(stdout).to.include('The access token was not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to list devices when user is signed-out and using the `--json` flag', async () => {
			await cli.logout();

			const args = ['product', 'device', 'list', PRODUCT_01_ID, '--json'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const json = parseAndSortDeviceList(stdout);

			expect(json).to.be.an('object');
			expect(json).to.have.all.keys('meta', 'error');
			expect(json.meta).to.have.all.keys('version');
			expect(json.meta.version).to.equal('1.0.0');
			expect(json.error).to.have.property('message').that.is.a('string');
			expect(json.error.message).include('HTTP error 400');
			expect(json.error.message).include('The access token was not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to show device detail when user is signed-out', async () => {
			await cli.logout();

			const args = ['product', 'device', 'list', PRODUCT_01_ID, PRODUCT_01_DEVICE_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('HTTP error 400');
			expect(stdout).to.include('The access token was not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to show device detail when user is signed-out and using the `--json` flag', async () => {
			await cli.logout();

			const args = ['product', 'device', 'list', PRODUCT_01_ID, PRODUCT_01_DEVICE_01_ID, '--json'];
			const { stdout, stderr, exitCode } = await cli.run(args);
			const json = parseAndSortDeviceList(stdout);

			expect(json).to.be.an('object');
			expect(json).to.have.all.keys('meta', 'error');
			expect(json.meta).to.have.all.keys('version');
			expect(json.meta.version).to.equal('1.0.0');
			expect(json.error).to.have.property('message').that.is.a('string');
			expect(json.error.message).include('HTTP error 400');
			expect(json.error.message).include('The access token was not found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Device Add Subcommand', () => {
		const deviceIDs = [PRODUCT_01_DEVICE_01_ID, PRODUCT_01_DEVICE_02_ID];
		const deviceIDsFilePath = path.join(PATH_TMP_DIR, 'product-device-ids.txt');
		const deviceIDsEmptyFilePath = path.join(PATH_TMP_DIR, 'product-device-ids-empty.txt');
		const help = [
			'Adds one or more devices into a Product',
			'Usage: particle product device add [options] <product> [device]',
			'',
			'Global Options:',
			'  -v, --verbose  Increases how much logging to display  [count]',
			'  -q, --quiet    Decreases how much logging to display  [count]',
			'',
			'Options:',
			'  --file, -f  Path to single column .txt file with list of IDs, S/Ns, IMEIs, or ICCIDs of the devices to add  [string]',
			'',
			'Examples:',
			'  particle product device add 12345 5a8ef38cb85f8720edce631a         Add device id 5a8ef38cb85f8720edce631a into product 12345',
			'  particle product device add 12345 --file ./path/to/device_ids.txt  Adds a list of devices into product 12345'
		];

		before(async () => {
			await cli.setTestProfileAndLogin();
		});

		beforeEach(async () => {
			await Promise.all([
				fs.writeFile(deviceIDsFilePath, deviceIDs.join(os.EOL), 'utf8'),
				fs.writeFile(deviceIDsEmptyFilePath, '', 'utf8')
			]);
		});

		// TODO (mirande): remove device from product first once we fully support
		// removing devices - see: https://app.clubhouse.io/particle/story/45489/product-device-is-not-removed
		it('Adds a single device', async () => {
			const args = ['product', 'device', 'add', PRODUCT_01_ID, PRODUCT_01_DEVICE_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`Success!${os.EOL + os.EOL}`);
			expect(stdout).to.include(`Product ${PRODUCT_01_ID} Includes:${os.EOL}`);
			expect(stdout).to.include(`  ${PRODUCT_01_DEVICE_01_ID}${os.EOL}`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Adds a single device when device was already in product', async () => {
			const args = ['product', 'device', 'add', PRODUCT_01_ID, PRODUCT_01_DEVICE_01_ID];
			await cli.run(args);
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`Success!${os.EOL + os.EOL}`);
			expect(stdout).to.include(`Product ${PRODUCT_01_ID} Includes:${os.EOL}`);
			expect(stdout).to.include(`  ${PRODUCT_01_DEVICE_01_ID}${os.EOL}`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to add a single device when `device` param or `--file` flag is not provided', async () => {
			const args = ['product', 'device', 'add', PRODUCT_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('`device` parameter or `--file` option is required');
			expect(stderr.split(os.EOL)).to.include.members(help);
			expect(exitCode).to.equal(1);
		});

		it('Fails to add a single device when `product` is unknown', async () => {
			const args = ['product', 'device', 'add', 'LOLWUTNOPE', PRODUCT_01_DEVICE_01_ID];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('HTTP error 404');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to add a single device when `device` is unknown', async () => {
			const args = ['product', 'device', 'add', PRODUCT_01_ID, 'LOLWUTNOPE'];
			const { stdout, stderr, exitCode } = await cli.run(args);

			// for an unknown reason the API does .toLowerCase() on the ID
			expect(stdout).to.include('Skipped Invalid IDs:');
			expect(stdout).to.include('  lolwutnope');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		// TODO (mirande): remove devices from product first once we fully support
		// removing devices - see: https://app.clubhouse.io/particle/story/45489/product-device-is-not-removed
		it('Adds multiple devices using the `--file` flag', async () => {
			const args = ['product', 'device', 'add', PRODUCT_01_ID, '--file', deviceIDsFilePath];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`Success!${os.EOL + os.EOL}`);
			expect(stdout).to.include(`Product ${PRODUCT_01_ID} Includes:${os.EOL}`);
			expect(stdout).to.include(`  ${PRODUCT_01_DEVICE_01_ID}${os.EOL}`);
			expect(stdout).to.include(`  ${PRODUCT_01_DEVICE_02_ID}${os.EOL}`);
			expect(stdout).to.not.include('Skipped Non-Member IDs:');
			expect(stdout).to.not.include('Skipped Invalid IDs:');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Adds multiple devices using the `--file` flag and logs skipped items', async () => {
			const data = ['WAT', PRODUCT_01_DEVICE_01_ID, 'NOPE', PRODUCT_01_DEVICE_02_ID, 'NOPE', 'LOL'];
			await fs.writeFile(deviceIDsFilePath, data.join(os.EOL), 'utf8');
			const args = ['product', 'device', 'add', PRODUCT_01_ID, '--file', deviceIDsFilePath];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`Success!${os.EOL + os.EOL}`);
			expect(stdout).to.include(`Product ${PRODUCT_01_ID} Includes:${os.EOL}`);
			expect(stdout).to.include(`  ${PRODUCT_01_DEVICE_01_ID}${os.EOL}`);
			expect(stdout).to.include(`  ${PRODUCT_01_DEVICE_02_ID}${os.EOL}`);
			expect(stdout).to.not.include('Skipped Non-Member IDs:');
			expect(stdout).to.include(`Skipped Invalid IDs:${os.EOL}`);
			expect(stdout).to.include(`  wat${os.EOL}`);
			expect(stdout).to.include(`  nope${os.EOL}`);
			expect(stdout).to.include(`  lol${os.EOL}`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Adds multiple devices using the `--file` flag when file uses windows-style line-breaks', async () => {
			await fs.writeFile(deviceIDsFilePath, deviceIDs.join('\r\n'), 'utf8');
			const args = ['product', 'device', 'add', PRODUCT_01_ID, '--file', deviceIDsFilePath];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include(`Success!${os.EOL + os.EOL}`);
			expect(stdout).to.include(`Product ${PRODUCT_01_ID} Includes:${os.EOL}`);
			expect(stdout).to.include(`  ${PRODUCT_01_DEVICE_01_ID}${os.EOL}`);
			expect(stdout).to.include(`  ${PRODUCT_01_DEVICE_02_ID}${os.EOL}`);
			expect(stdout).to.not.include('Skipped Non-Member IDs:');
			expect(stdout).to.not.include('Skipped Invalid IDs:');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Fails to add multiple devices when `--file` is empty', async () => {
			const args = ['product', 'device', 'add', PRODUCT_01_ID, '--file', deviceIDsEmptyFilePath];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('product-device-ids-empty.txt is empty');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

		it('Fails to add multiple devices when `--file` is not found', async () => {
			const args = ['product', 'device', 'add', PRODUCT_01_ID, '--file', path.join(PATH_TMP_DIR, 'missing.txt')];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.include('missing.txt does not exist');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	function parseAndSortProductList(stdout){
		const json = JSON.parse(stdout);

		if (json.error){
			return json;
		}
		json.data.sort((a, b) => a.id > b.id ? 1 : -1);
		return json;
	}

	function parseAndSortDeviceList(stdout){
		const json = JSON.parse(stdout);

		if (json.error){
			return json;
		}
		json.data.sort((a, b) => a.name > b.name ? 1 : -1);
		return json;
	}
});

