const stream = require('stream');
const Spinner = require('cli-spinner').Spinner;
const { expect, sinon } = require('../../../test/setup');
const UI = require('./index');
const inquirer = require('inquirer');

describe('UI', () => {
	let stdin, stdout, stderr, ui;

	beforeEach(() => {
		stdin = new stream.Readable();
		stdout = new stream.Writable({
			write: (chunk, encoding, callback) => {
				stdout.content = (stdout.content || '') + chunk;
				callback();
			}
		});
		stderr = new stream.Writable({
			write: (chunk, encoding, callback) => {
				stderr.content = (stderr.content || '') + chunk;
				callback();
			}
		});

		ui = new UI({ stdin, stdout, stderr });
		// disable colored output so testing across environments with varied
		// color level support is more predictable
		ui.chalk.enabled = false;
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('Writing to `stdout` and `stderr`', () => {
		it('Writes to `stdout`', () => {
			const msg = 'one two three';
			ui.write(msg);

			expect(stdout.content).to.equal(msg + ui.EOL);
		});

		it('Writes to `stderr`', () => {
			const msg = 'four five six';
			ui.error(msg);

			expect(stderr.content).to.equal(msg + ui.EOL);
		});
	});

	describe('prompt', () => {
		let mode;
		beforeEach(() => {
			mode = global.isInteractive;
		});
		afterEach(() => {
			global.isInteractive = mode;
		});

		it('throws an error when in non-interactive mode', async () => {
			global.isInteractive = false;

			let error;
			try {
				await ui.prompt();
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(Error).with.property('message', 'Prompts are not allowed in non-interactive mode');
		});

		it('allows passing a custom non-interactive error message', async () => {
			global.isInteractive = false;

			let error;
			try {
				await ui.prompt([], { nonInteractiveError: 'Custom error message' });
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(Error).with.property('message', 'Custom error message');
		});

		it('creates a prompt in interactive mode', async () => {
			global.isInteractive = true;
			const stub = sinon.stub(inquirer, 'prompt').resolves();
			const question = { name: 'test', message: 'Do it?' };

			await ui.prompt([question]);

			expect(stub).to.have.been.calledWith([question]);
		});
	});

	describe('Spinner helpers', () => {
		beforeEach(() => {
			sinon.spy(Spinner.prototype, 'start');
			sinon.spy(Spinner.prototype, 'stop');
		});

		it('Shows a spinner until promise is resolved', async () => {
			const message = 'testing...';
			const promise = delay(200, 'ok');
			const x = await ui.showBusySpinnerUntilResolved(message, promise);

			expect(x).to.equal('ok');
			expect(stdout.content).to.include('\u001b[2K\u001b[1G▌ testing...');
			expect(Spinner.prototype.start).to.have.property('callCount', 1);
			expect(Spinner.prototype.stop).to.have.property('callCount', 1);
		});

		it('Shows a spinner until promise is rejected', async () => {
			let error = null;
			const message = 'testing...';
			const promise = delay(200).then(() => {
				throw new Error('nope!');
			});

			try {
				await ui.showBusySpinnerUntilResolved(message, promise);
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'nope!');
			expect(stdout.content).to.include('\u001b[2K\u001b[1G▌ testing...');
			expect(Spinner.prototype.start).to.have.property('callCount', 1);
			expect(Spinner.prototype.stop).to.have.property('callCount', 1);
		});
	});

	describe('Logging device details', () => {
		it('Logs details for a single device', () => {
			const [device] = getDetailedDeviceList();
			ui.logDeviceDetail(device);

			expect(stdout.content).to.equal([
				'test-photon [000000000e00000000000001] (Photon) is offline',
				'  Variables:',
				'    name (string)',
				'    version (int32)',
				'    blinking (int32)',
				'  Functions:',
				'    int check (String args) ',
				'    int stop (String args) ',
				'    int start (String args) ',
				'    int toggle (String args) ',
				''
			].join(ui.EOL));
		});

		it('Logs details for a single device excluding cloud variables', () => {
			const [device] = getDetailedDeviceList();
			ui.logDeviceDetail(device, { fnsOnly: true });

			expect(stdout.content).to.equal([
				'test-photon [000000000e00000000000001] (Photon) is offline',
				'  Functions:',
				'    int check (String args) ',
				'    int stop (String args) ',
				'    int start (String args) ',
				'    int toggle (String args) ',
				''
			].join(ui.EOL));
		});

		it('Logs details for a single device excluding cloud functions', () => {
			const [device] = getDetailedDeviceList();
			ui.logDeviceDetail(device, { varsOnly: true });

			expect(stdout.content).to.equal([
				'test-photon [000000000e00000000000001] (Photon) is offline',
				'  Variables:',
				'    name (string)',
				'    version (int32)',
				'    blinking (int32)',
				''
			].join(ui.EOL));
		});

		it('Logs details for a single product device', () => {
			const [device] = getDetailedProductDeviceList();
			ui.logDeviceDetail(device);

			expect(stdout.content).to.equal([
				'prod-test-01 [e00fce0000dba0f00f000d0d] (Product 12345) is online',
				'  Variables:',
				'    name (string)',
				'    version (int32)',
				'    blinking (int32)',
				'  Functions:',
				'    int check (String args) ',
				'    int stop (String args) ',
				'    int start (String args) ',
				'    int toggle (String args) ',
				''
			].join(ui.EOL));
		});

		it('Logs details for a single device summary', () => {
			const [device] = getDeviceList();
			ui.logDeviceDetail(device);

			expect(stdout.content).to.equal([
				'test-photon [000000000e00000000000001] (Photon) is offline',
				''
			].join(ui.EOL));
		});

		it('Logs details for a single product device summary', () => {
			const [device] = getProductDeviceList();
			ui.logDeviceDetail(device);

			expect(stdout.content).to.equal([
				'prod-test-01 [e00fce0000dba0f00f000d0d] (Product 12345) is online',
				''
			].join(ui.EOL));
		});

		it('Logs details for multiple devices', () => {
			const devices = getDetailedDeviceList();
			ui.logDeviceDetail(devices);

			expect(stdout.content).to.equal([
				'test-photon [000000000e00000000000001] (Photon) is offline',
				'  Variables:',
				'    name (string)',
				'    version (int32)',
				'    blinking (int32)',
				'  Functions:',
				'    int check (String args) ',
				'    int stop (String args) ',
				'    int start (String args) ',
				'    int toggle (String args) ',
				'test-boron [e00fce0000f0c0a00c00e00a] (Boron) is online',
				'  Functions:',
				'    int start (String args) ',
				'    int stop (String args) ',
				'test-argon [e00fce00000e0df000f0000c] (Argon) is online',
				'  Functions:',
				'    int start (String args) ',
				'    int stop (String args) ',
				''
			].join(ui.EOL));
		});

		it('Logs details for multiple devices excluding cloud variables', () => {
			const devices = getDetailedDeviceList();
			ui.logDeviceDetail(devices, { fnsOnly: true });

			expect(stdout.content).to.equal([
				'test-photon [000000000e00000000000001] (Photon) is offline',
				'  Functions:',
				'    int check (String args) ',
				'    int stop (String args) ',
				'    int start (String args) ',
				'    int toggle (String args) ',
				'test-boron [e00fce0000f0c0a00c00e00a] (Boron) is online',
				'  Functions:',
				'    int start (String args) ',
				'    int stop (String args) ',
				'test-argon [e00fce00000e0df000f0000c] (Argon) is online',
				'  Functions:',
				'    int start (String args) ',
				'    int stop (String args) ',
				''
			].join(ui.EOL));
		});

		it('Logs details for multiple devices excluding cloud functions', () => {
			const devices = getDetailedDeviceList();
			ui.logDeviceDetail(devices, { varsOnly: true });

			expect(stdout.content).to.equal([
				'test-photon [000000000e00000000000001] (Photon) is offline',
				'  Variables:',
				'    name (string)',
				'    version (int32)',
				'    blinking (int32)',
				'test-boron [e00fce0000f0c0a00c00e00a] (Boron) is online',
				'test-argon [e00fce00000e0df000f0000c] (Argon) is online',
				''
			].join(ui.EOL));
		});

		it('Logs details for multiple product devices', () => {
			const devices = getDetailedProductDeviceList();
			ui.logDeviceDetail(devices);

			expect(stdout.content).to.equal([
				'prod-test-01 [e00fce0000dba0f00f000d0d] (Product 12345) is online',
				'  Variables:',
				'    name (string)',
				'    version (int32)',
				'    blinking (int32)',
				'  Functions:',
				'    int check (String args) ',
				'    int stop (String args) ',
				'    int start (String args) ',
				'    int toggle (String args) ',
				'prod-test-02 [e00fce0000000ce0de0000dd] (Product 12345) is offline',
				'  Variables:',
				'    name (string)',
				'    version (int32)',
				'    blinking (int32)',
				'  Functions:',
				'    int check (String args) ',
				'    int stop (String args) ',
				'    int start (String args) ',
				'    int toggle (String args) ',
				''
			].join(ui.EOL));
		});

		it('Logs details for multiple device summaries', () => {
			const devices = getDeviceList();
			ui.logDeviceDetail(devices);

			expect(stdout.content).to.equal([
				'test-photon [000000000e00000000000001] (Photon) is offline',
				'test-boron [e00fce0000f0c0a00c00e00a] (Boron) is online',
				'test-argon [e00fce00000e0df000f0000c] (Argon) is online',
				''
			].join(ui.EOL));
		});

		it('Logs details for multiple product device summaries', () => {
			const devices = getProductDeviceList();
			ui.logDeviceDetail(devices);

			expect(stdout.content).to.equal([
				'prod-test-01 [e00fce0000dba0f00f000d0d] (Product 12345) is online',
				'prod-test-02 [e00fce0000000ce0de0000dd] (Product 12345) is offline',
				''
			].join(ui.EOL));
		});
	});

	function delay(ms, value){
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	function getDeviceList(){
		return [
			{
				id: '000000000e00000000000001',
				name: 'test-photon',
				last_app: null,
				last_ip_address: '192.0.2.0',
				last_heard: '2020-01-20T02:53:29.854Z',
				product_id: 6,
				connected: false,
				platform_id: 6,
				cellular: false,
				notes: 'test photon notes',
				status: 'normal',
				serial_number: 'XXXX-000000-0X0X-0',
				current_build_target: '1.4.4',
				system_firmware_version: '1.4.4',
				default_build_target: '1.4.4'
			},
			{
				id: 'e00fce0000f0c0a00c00e00a',
				name: 'test-boron',
				last_app: null,
				last_ip_address: '192.0.2.1',
				last_heard: '2020-01-19T22:44:53.444Z',
				product_id: 13,
				connected: true,
				platform_id: 13,
				cellular: true,
				notes: 'test boron notes',
				status: 'normal',
				serial_number: 'X00XXX000XXXXXX',
				iccid: '89011700000000000000',
				last_iccid: '89011700000000000000',
				imei: '000000000000000',
				mobile_secret: '0X0XXX0XX0X0XXX',
				current_build_target: '1.4.4',
				system_firmware_version: '1.4.4',
				default_build_target: '1.4.4'
			},
			{
				id: 'e00fce00000e0df000f0000c',
				name: 'test-argon',
				last_app: null,
				last_ip_address: '192.0.2.2',
				last_heard: '2020-01-18T00:29:30.269Z',
				product_id: 12,
				connected: true,
				platform_id: 12,
				cellular: false,
				notes: null,
				status: 'normal',
				serial_number: 'XXXXXX000XXX0X0',
				mobile_secret: 'X0XXXXXXXXXXXXX',
				current_build_target: '1.4.4',
				system_firmware_version: '1.4.4',
				default_build_target: '1.4.4'
			}
		];
	}

	function getDetailedDeviceList(){
		return [
			{
				id: '000000000e00000000000001',
				name: 'test-photon',
				last_app: null,
				last_ip_address: '192.0.2.0',
				last_heard: '2020-01-20T02:53:29.854Z',
				product_id: 6,
				connected: false,
				platform_id: 6,
				cellular: false,
				notes: 'test photon notes',
				status: 'normal',
				serial_number: 'XXXX-000000-0X0X-0',
				current_build_target: '1.4.4',
				system_firmware_version: '1.4.4',
				default_build_target: '1.4.4',
				variables: {
					name: 'string',
					version: 'int32',
					blinking: 'int32'
				},
				functions: [
					'check',
					'stop',
					'start',
					'toggle'
				],
				firmware_updates_enabled: true,
				firmware_updates_forced: false
			},
			{
				id: 'e00fce0000f0c0a00c00e00a',
				name: 'test-boron',
				last_app: null,
				last_ip_address: '192.0.2.1',
				last_heard: '2020-01-19T22:44:53.444Z',
				product_id: 13,
				connected: true,
				platform_id: 13,
				cellular: true,
				notes: 'test boron notes',
				network: {
					id: '0xx0x000xxx0xx0000x00000',
					name: 'test-mesh-network',
					type: 'micro_wifi',
					role: {
						gateway: true,
						state: 'confirmed'
					}
				},
				status: 'normal',
				serial_number: 'X00XXX000XXXXXX',
				iccid: '89011700000000000000',
				last_iccid: '89011700000000000000',
				imei: '000000000000000',
				mobile_secret: '0X0XXX0XX0X0XXX',
				current_build_target: '1.4.4',
				system_firmware_version: '1.4.4',
				default_build_target: '1.4.4',
				variables: {},
				functions: [
					'start',
					'stop'
				],
				firmware_updates_enabled: true,
				firmware_updates_forced: false
			},
			{
				id: 'e00fce00000e0df000f0000c',
				name: 'test-argon',
				last_app: null,
				last_ip_address: '192.0.2.2',
				last_heard: '2020-01-18T00:29:30.269Z',
				product_id: 12,
				connected: true,
				platform_id: 12,
				cellular: false,
				notes: null,
				network: {
					id: '0xx0x000xxx0xx0000x00000',
					name: 'test-mesh-network',
					type: 'micro_wifi',
					role: {
						gateway: false,
						state: 'pending'
					}
				},
				status: 'normal',
				serial_number: 'XXXXXX000XXX0X0',
				mobile_secret: 'X0XXXXXXXXXXXXX',
				current_build_target: '1.4.4',
				system_firmware_version: '1.4.4',
				default_build_target: '1.4.4',
				variables: {},
				functions: [
					'start',
					'stop'
				],
				firmware_updates_enabled: true,
				firmware_updates_forced: false
			}
		];
	}

	function getProductDeviceList(){
		return [
			{
				id: 'e00fce0000dba0f00f000d0d',
				product_id: 12345,
				last_ip_address: '192.0.2.3',
				firmware_version: 1,
				last_handshake_at: '2020-01-24T14:47:03.150Z',
				online: true,
				name: 'prod-test-01',
				platform_id: 12,
				notes: 'here are some notes for testing',
				firmware_product_id: 12345,
				quarantined: false,
				denied: false,
				development: false,
				groups: [
					'foo'
				],
				targeted_firmware_release_version: null,
				system_firmware_version: '1.4.4',
				serial_number: 'XXXXXX000XXXXXX',
				owner: null
			},
			{
				id: 'e00fce0000000ce0de0000dd',
				product_id: 12345,
				last_ip_address: '192.0.2.4',
				last_handshake_at: '2020-01-24T14:47:02.380Z',
				online: false,
				name: 'prod-test-02',
				platform_id: 12,
				firmware_product_id: 12,
				quarantined: false,
				denied: false,
				development: false,
				groups: [],
				targeted_firmware_release_version: null,
				system_firmware_version: '1.1.0',
				serial_number: 'XXXXXX000X0XXXX',
				owner: null
			}
		];
	}

	function getDetailedProductDeviceList(){
		return [
			{
				id: 'e00fce0000dba0f00f000d0d',
				name: 'prod-test-01',
				last_app: null,
				last_ip_address: '192.0.2.3',
				last_heard: '2020-01-24T14:47:03.150Z',
				product_id: 12345,
				connected: true,
				platform_id: 12,
				cellular: false,
				notes: 'here are some notes for testing',
				status: 'normal',
				serial_number: 'XXXXXX000XXXXXX',
				mobile_secret: '0XXX000XXXXX0XX',
				current_build_target: '1.4.4',
				system_firmware_version: '1.4.4',
				default_build_target: '1.4.4',
				variables: {
					name: 'string',
					version: 'int32',
					blinking: 'int32'
				},
				functions: [
					'check',
					'stop',
					'start',
					'toggle'
				],
				groups: [
					'foo'
				],
				targeted_firmware_release_version: null
			},
			{
				id: 'e00fce0000000ce0de0000dd',
				name: 'prod-test-02',
				last_app: null,
				last_ip_address: '192.0.2.4',
				last_heard: '2020-01-24T14:47:02.380Z',
				product_id: 12345,
				connected: false,
				platform_id: 12,
				cellular: false,
				notes: null,
				status: 'normal',
				serial_number: 'XXXXXX000X0XXXX',
				mobile_secret: 'X0X0Y0XXXX0XXX0',
				current_build_target: '1.1.0',
				system_firmware_version: '1.1.0',
				default_build_target: '1.4.4',
				variables: {
					name: 'string',
					version: 'int32',
					blinking: 'int32'
				},
				functions: [
					'check',
					'stop',
					'start',
					'toggle'
				],
				groups: [],
				targeted_firmware_release_version: null
			}
		];
	}
});
