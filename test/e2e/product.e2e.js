const os = require('os');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	PRODUCT_01_ID,
	PRODUCT_01_DEVICE_01_ID,
	PRODUCT_01_DEVICE_01_NAME,
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
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('product');
		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['product', '--help']);
		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	describe('Device List Subcommand', () => {
		const summaryDeviceFieldNames = ['denied', 'desired_firmware_version',
			'development', 'firmware_product_id', 'groups', 'iccid', 'id', 'imei',
			'last_handshake_at', 'last_iccid', 'last_ip_address', 'name', 'notes',
			'online', 'owner', 'platform_id', 'product_id', 'quarantined',
			'serial_number', 'system_firmware_version',
			'targeted_firmware_release_version', 'user_id'];
		const detailedDeviceFieldNames = ['cellular', 'connected',
			'current_build_target', 'default_build_target', 'functions', 'groups',
			'iccid', 'id', 'imei', 'last_app', 'last_heard', 'last_iccid',
			'last_ip_address', 'mobile_secret', 'name', 'notes', 'platform_id',
			'product_id', 'serial_number', 'status', 'system_firmware_version',
			'targeted_firmware_release_version', 'variables'];

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
			expect(json.data[0]).to.have.all.keys(summaryDeviceFieldNames);
			expect(json.data[0].id).to.equal(PRODUCT_01_DEVICE_01_ID);
			expect(json.data[0].name).to.equal(PRODUCT_01_DEVICE_01_NAME);
			expect(`${json.data[0].product_id}`).to.equal(PRODUCT_01_ID);
			expect(json.data[1]).to.have.all.keys(summaryDeviceFieldNames);
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
			expect(json.data).to.have.all.keys(detailedDeviceFieldNames);
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

	function parseAndSortDeviceList(stdout){
		const json = JSON.parse(stdout);

		if (json.error){
			return json;
		}
		json.data.sort((a, b) => a.name > b.name ? 1 : -1);
		return json;
	}
});

