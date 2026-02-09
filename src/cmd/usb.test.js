'use strict';
const { expect, sinon } = require('../../test/setup');
const { default: stripAnsi } = require('strip-ansi');
const proxyquire = require('proxyquire');
const { Result } = require('particle-usb');
const UsbCommands = require('./usb');

describe('USB Commands', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});


	describe('_formatNetworkIfaceOutput', () => {
		it('formats the interface information to imitate linux `ifconfig` command', () => {
			const nwInfo = [
				{
					'index': 5,
					'name': 'wl4',
					'type': 'WIFI',
					'hwAddress': '94:94:4a:04:af:80',
					'mtu': 1500,
					'flagsVal': 98371,
					'extFlags': 1114112,
					'flagsStrings': ['UP', 'BROADCAST', 'LOWER_UP', 'LOWER_UP', 'MULTICAST', 'NOND6'],
					'metric': 0,
					'profile': Buffer.alloc(0),
					'ipv4Config': {
						'addresses': ['10.2.3.4/32'],
						'gateway': null,
						'peer': null,
						'dns': [],
						'source': 'NONE'
					},
					'ipv6Config': {
						'addresses': [],
						'gateway': null,
						'dns': [],
						'source': 'NONE'
					}
				},
				{
					'index': 4,
					'name': 'pp3',
					'type': 'PPP',
					'hwAddress': '',
					'mtu': 1500,
					'flagsVal': 81,
					'extFlags': 1048576,
					'flagsStrings': ['UP', 'POINTOPOINT', 'LOWER_UP', 'LOWER_UP'],
					'metric': 0,
					'profile': Buffer.alloc(0),
					'ipv4Config': {
						'addresses': ['10.20.30.40/32'],
						'gateway': null,
						'peer': null,
						'dns': [],
						'source': 'NONE'
					},
					'ipv6Config': {
						'addresses': [],
						'gateway': null,
						'dns': [],
						'source': 'NONE'
					}
				},
				{
					'index': 1,
					'name': 'lo0',
					'type': 'LOOPBACK',
					'hwAddress': '',
					'mtu': 0,
					'flagsVal': 73,
					'extFlags': 0,
					'flagsStrings': ['UP', 'LOOPBACK', 'LOWER_UP', 'LOWER_UP'],
					'metric': 0,
					'profile': Buffer.alloc(0),
					'ipv4Config': {
						'addresses': ['10.11.12.13/32'],
						'gateway': null,
						'peer': null,
						'dns': [],
						'source': 'NONE'
					},
					'ipv6Config': {
						'addresses': ['0000:0000:0000:0000:0000:0000:0000:0001/64'],
						'gateway': null,
						'dns': [],
						'source': 'NONE'
					}
				}
			];

			const expectedOutput = [
				'Device ID: 0123456789abcdef (p2)',
				'\twl4(WIFI): flags=98371<UP,BROADCAST,LOWER_UP,LOWER_UP,MULTICAST,NOND6> mtu 1500',
				'\t\tinet 10.2.3.4 netmask 255.255.255.255',
				'\t\tether 94:94:4a:04:af:80',
				'\tpp3(PPP): flags=81<UP,POINTOPOINT,LOWER_UP,LOWER_UP> mtu 1500',
				'\t\tinet 10.20.30.40 netmask 255.255.255.255',
				'\tlo0(LOOPBACK): flags=73<UP,LOOPBACK,LOWER_UP,LOWER_UP> mtu 0',
				'\t\tinet 10.11.12.13 netmask 255.255.255.255',
				'\t\tinet6 0000:0000:0000:0000:0000:0000:0000:0001 prefixlen 64'
			];

			const usbCommands = new UsbCommands({
				settings: {
					access_token: '1234'
				},
			});
			const res = usbCommands._formatNetworkIfaceOutput(nwInfo, 'p2', '0123456789abcdef');

			expect(res.map(stripAnsi)).to.eql(expectedOutput);
		});
	});

	describe('_formatEnvOutput', () => {
		let usbCommands;

		beforeEach(() => {
			usbCommands = new UsbCommands({
				access_token: '1234',
				apiUrl: 'https://api.particle.io'
			});
		});

		it('formats output with application variables only', () => {
			const result = {
				env: {
					FOO: { value: 'bar', isApp: true },
					TEST: { value: 'baz', isApp: true }
				}
			};

			const output = usbCommands._formatEnvOutput(result, 'P2', '0123456789abcdef');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput).to.deep.equal([
				'',
				'Device: 0123456789abcdef (P2)',
				'',
				'Environment Variables:',
				'  Firmware:',
				'    FOO=bar',
				'    TEST=baz',
				''
			]);
		});

		it('formats output with system variables only', () => {
			const result = {
				env: {
					SYS_VAR1: { value: 'value1', isApp: false },
					SYS_VAR2: { value: 'value2', isApp: false }
				}
			};

			const output = usbCommands._formatEnvOutput(result, 'P2', '0123456789abcdef');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput).to.deep.equal([
				'',
				'Device: 0123456789abcdef (P2)',
				'',
				'Environment Variables:',
				'  Cloud:',
				'    SYS_VAR1=value1',
				'    SYS_VAR2=value2',
				''
			]);
		});

		it('formats output with both application and system variables', () => {
			const result = {
				env: {
					APP_KEY: { value: 'app_value', isApp: true },
					SYS_KEY: { value: 'sys_value', isApp: false },
					ANOTHER_APP: { value: 'another_app', isApp: true }
				}
			};

			const output = usbCommands._formatEnvOutput(result, 'Photon', 'abc123def456');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput).to.deep.equal([
				'',
				'Device: abc123def456 (Photon)',
				'',
				'Environment Variables:',
				'  Firmware:',
				'    ANOTHER_APP=another_app',
				'    APP_KEY=app_value',
				'',
				'  Cloud:',
				'    SYS_KEY=sys_value',
				''
			]);
		});

		it('formats output when no environment variables are set', () => {
			const result = {
				env: {}
			};

			const output = usbCommands._formatEnvOutput(result, 'Argon', 'device123');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput).to.deep.equal([
				'',
				'Device: device123 (Argon)',
				'  No environment variables set',
				''
			]);
		});

		it('sorts variables alphabetically within each category', () => {
			const result = {
				env: {
					ZEBRA: { value: 'z', isApp: true },
					APPLE: { value: 'a', isApp: true },
					BANANA: { value: 'b', isApp: true },
					SYS_Z: { value: 'sz', isApp: false },
					SYS_A: { value: 'sa', isApp: false }
				}
			};

			const output = usbCommands._formatEnvOutput(result, 'P2', 'device123');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput).to.deep.equal([
				'',
				'Device: device123 (P2)',
				'',
				'Environment Variables:',
				'  Firmware:',
				'    APPLE=a',
				'    BANANA=b',
				'    ZEBRA=z',
				'',
				'  Cloud:',
				'    SYS_A=sa',
				'    SYS_Z=sz',
				''
			]);
		});

		it('handles special characters in values', () => {
			const result = {
				env: {
					SPECIAL: { value: 'value with spaces & symbols!@#$%', isApp: true }
				}
			};

			const output = usbCommands._formatEnvOutput(result, 'P2', 'device123');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput).to.deep.equal([
				'',
				'Device: device123 (P2)',
				'',
				'Environment Variables:',
				'  Firmware:',
				'    SPECIAL=value with spaces & symbols!@#$%',
				''
			]);
		});
	});

	describe('sendRequest', () => {
		let UsbCommands;
		let usbCommands;
		let forEachUsbDeviceStub;
		let consoleLogStub;

		beforeEach(() => {
			forEachUsbDeviceStub = sandbox.stub();
			consoleLogStub = sandbox.stub(console, 'log');

			UsbCommands = proxyquire('./usb', {
				'./usb-util': {
					CUSTOM_CONTROL_REQUEST_CODE: 10,
					forEachUsbDevice: forEachUsbDeviceStub,
					getUsbDevices: sandbox.stub(),
					openUsbDevice: sandbox.stub(),
					TimeoutError: class TimeoutError extends Error {},
					DeviceProtectionError: class DeviceProtectionError extends Error {},
					executeWithUsbDevice: sandbox.stub()
				}
			});

			usbCommands = new UsbCommands({
				access_token: '1234'
			});
		});

		it('sends a control request successfully without response data', async () => {
			const args = {
				params: {
					payload: 'test_payload',
					devices: []
				},
				timeout: 5000
			};

			const mockUsbDevice = {
				id: 'test_device_id',
				sendControlRequest: sandbox.stub().resolves({
					result: 0,
					data: null
				})
			};

			forEachUsbDeviceStub.callsFake(async (args, callback) => {
				await callback(mockUsbDevice);
			});

			await usbCommands.sendRequest(args);

			expect(mockUsbDevice.sendControlRequest).to.have.been.calledWith(10, 'test_payload', { timeout: 5000 });
			const calls = consoleLogStub.getCalls().map(call => stripAnsi(call.args[0]));
			expect(calls).to.include.members([
				'Device test_device_id:',
				'Command was successfully sent to device test_device_id.'
			]);
		});

		it('sends a control request successfully with response data', async () => {
			const args = {
				params: {
					payload: '{"key":"value"}',
					devices: []
				},
				timeout: 10000
			};

			const mockUsbDevice = {
				id: 'test_device_id',
				sendControlRequest: sandbox.stub().resolves({
					result: 0,
					data: 'response_data'
				})
			};

			forEachUsbDeviceStub.callsFake(async (args, callback) => {
				await callback(mockUsbDevice);
			});

			await usbCommands.sendRequest(args);

			expect(mockUsbDevice.sendControlRequest).to.have.been.calledWith(10, '{"key":"value"}', { timeout: 10000 });
			const calls = consoleLogStub.getCalls().map(call => stripAnsi(call.args[0]));
			expect(calls).to.include.members([
				'Device test_device_id:',
				'Command was successfully sent to device test_device_id.',
				'Response from device test_device_id: response_data'
			]);
		});

		it('handles NOT_SUPPORTED error result with helpful message', async () => {
			const args = {
				params: {
					payload: 'test',
					devices: []
				},
				timeout: 5000
			};

			const mockUsbDevice = {
				id: 'test_device_id',
				sendControlRequest: sandbox.stub().resolves({
					result: Result.NOT_SUPPORTED,
					data: null
				})
			};

			forEachUsbDeviceStub.callsFake(async (args, callback) => {
				await callback(mockUsbDevice);
			});

			await usbCommands.sendRequest(args);

			const calls = consoleLogStub.getCalls().map(call => stripAnsi(call.args[0]));
			expect(calls).to.include('Device test_device_id:');
			expect(calls.some(call => call.includes('Your firmware doesn\'t include a handler for application-specific requests'))).to.be.true;
			expect(calls.some(call => call.includes('ctrl_request_custom_handler'))).to.be.true;
		});

		it('handles NOT_ALLOWED error result', async () => {
			const args = {
				params: {
					payload: 'test',
					devices: []
				},
				timeout: 5000
			};

			const mockUsbDevice = {
				id: 'test_device_id',
				sendControlRequest: sandbox.stub().resolves({
					result: Result.NOT_ALLOWED,
					data: null
				})
			};

			forEachUsbDeviceStub.callsFake(async (args, callback) => {
				await callback(mockUsbDevice);
			});

			await usbCommands.sendRequest(args);

			const calls = consoleLogStub.getCalls().map(call => stripAnsi(call.args[0]));
			expect(calls).to.include('Device test_device_id:');
			expect(calls.some(call => call.includes('Error sending request to device test_device_id: NOT_ALLOWED'))).to.be.true;
		});

		it('handles unknown error result code', async () => {
			const args = {
				params: {
					payload: 'test',
					devices: []
				},
				timeout: 5000
			};

			const mockUsbDevice = {
				id: 'test_device_id',
				sendControlRequest: sandbox.stub().resolves({
					result: 9999,
					data: null
				})
			};

			forEachUsbDeviceStub.callsFake(async (args, callback) => {
				await callback(mockUsbDevice);
			});

			await usbCommands.sendRequest(args);

			const calls = consoleLogStub.getCalls().map(call => stripAnsi(call.args[0]));
			expect(calls).to.include('Device test_device_id:');
			expect(calls.some(call => call.includes('Error sending request to device test_device_id: 9999'))).to.be.true;
		});
	});
});
