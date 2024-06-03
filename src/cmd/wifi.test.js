const { expect, sinon } = require('../../test/setup');
const WiFiCommands = require('./wifi');
const usbUtils = require('../cmd/usb-util');
const utilities = require('../lib/utilities');
const fs = require('fs-extra');
const path = require('path');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const os = require('os');

describe('Wifi Commands', () => {
	let ui, newSpin, stopSpin;
	let openDevice;

	beforeEach(() => {
		sinon.stub(utilities, 'delay').resolves();
		ui = {
			stdout: {
				write: sinon.stub()
			},
			stderr: {
				write: sinon.stub()
			}
		};
		newSpin = sinon.stub().returns({
			start: sinon.stub().callsFake(() => {
				return {
					setSpinnerTitle: sinon.stub()
				};
			}),
			stop: sinon.stub() });
		stopSpin = sinon.stub();
		openDevice = {
			deviceId: 'deviceId',
			isOpen: true,
			close: sinon.stub(),
			reset: sinon.stub(),
			scanWifiNetworks: sinon.stub(),
			joinNewWifiNetwork: sinon.stub(),
			getDeviceMode: sinon.stub().resolves()
		};
		usbUtils.getOneUsbDevice = sinon.stub();
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('_serializeNetworks', () => {
		it('returns a list of networks', () => {
			const networks = [
				{
					ssid: 'network1',
					security: 'WPA2',
					rssi: -50,
					channel: 6
				},
				{
					ssid: 'network2',
					security: 'NO_SECURITY',
					rssi: -70,
					channel: 11
				}
			];
			const wifiCommands = new WiFiCommands({ ui });

			const result = wifiCommands._serializeNetworks(networks);
			expect(result).to.eql([
				{
					ssid: 'network1',
					security: 'WPA2',
					signal_level: -50,
					channel: '6',
					unsecure: false,
					mac: ''
				},
				{
					ssid: 'network2',
					security: 'NO_SECURITY',
					signal_level: -70,
					channel: '11',
					unsecure: true,
					mac: ''
				}]);
		});
	});

	describe('_pickNetworkManually', () => {
		it('prompts for ssid and password', async () => {
			const wifiCommands = new WiFiCommands({ ui });
			ui.prompt = sinon.stub();
			ui.prompt
				.onCall(0).returns({ hidden: false })
				.onCall(1).returns({ ssid: 'ssid' })
				.onCall(2).returns({ security: 'WPA2_PSK' })
				.onCall(3).returns({ password: 'password' });

			const result = await wifiCommands._pickNetworkManually();

			expect(result).to.eql({ ssid: 'ssid', security: 'WPA2_PSK', password: 'password', hidden: false });
			expect(ui.prompt).to.have.callCount(4);
			expect(ui.prompt.firstCall).to.have.been.calledWith([{
				default: false,
				message: 'Is this a hidden network?',
				type: 'confirm',
				name: 'hidden'
			}]);
			expect(ui.prompt.secondCall).to.have.been.calledWith([{
				type: 'input',
				name: 'ssid',
				message: 'SSID',
				validate: sinon.match.func,
				filter: sinon.match.func
			}]);
			expect(ui.prompt.thirdCall).to.have.been.calledWith([{
				choices: ['NO_SECURITY', 'WEP', 'WPA_PSK', 'WPA2_PSK', 'WPA3_PSK'],
				type: 'list',
				name: 'security',
				message: 'Select the security type for your Wi-Fi network:'
			}]);
			expect(ui.prompt.lastCall).to.have.been.calledWith([{
				type: 'input',
				name: 'password',
				message: 'Wi-Fi Password',
				validate: sinon.match.func
			}]);
		});
	});

	describe('_filterNetworks', () => {
		it('filters out and remove null, undefined and 5GHZ networks', () => {
			const networks = [
				{
					ssid: null,
					bssid: 'abc123',
					security: 'WPA2',
					rssi: -50,
					channel: 6
				},
				{
					ssid: 'network1',
					bssid: 'def456',
					security: 'WPA2',
					rssi: -50,
					channel: 6
				},
				{
					ssid: 'network2',
					bssid: 'ghi789',
					security: 'WPA2',
					rssi: -50,
					channel: 15
				},
				null,
			];
			const wifiCommands = new WiFiCommands({ ui });

			const result = wifiCommands._filterNetworks(networks);

			expect(result).to.eql([
				{
					ssid: 'network1',
					bssid: 'def456',
					security: 'WPA2',
					rssi: -50,
					channel: 6
				},
			]);
		});
	});

	describe('_deviceScanNetworks', () => {
		it('returns a list of networks from a particle device', async () => {
			openDevice.scanWifiNetworks.resolves([{
				ssid: 'network1',
				security: 'WPA2',
				rssi: -50,
				channel: 6
			}]);
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands.device = openDevice;

			const networks = await wifiCommands._deviceScanNetworks();

			expect(networks).to.eql([{
				ssid: 'network1',
				security: 'WPA2',
				signal_level: -50,
				channel: '6',
				unsecure: false,
				mac: ''
			}]);
		});

		it('throws an error if fails after retrying', async () => {
			openDevice.scanWifiNetworks.rejects(new Error('error'));
			let error;
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands.device = openDevice;

			try {
				await wifiCommands._deviceScanNetworks({ customRetryCount: 1 });
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.eql('Unable to scan for Wi-Fi networks: error\n');
			expect(utilities.delay).to.have.been.calledWith(1000);
		});

		it('returns empty if there is no networks', async () => {
			openDevice.scanWifiNetworks.resolves([]);
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands.device = openDevice;

			const networks = await wifiCommands._deviceScanNetworks();

			expect(networks).to.eql([]);

		});
	});

	describe('_promptToSelectNetwork', () => {
		it('prompts to select a network', async () => {
			const networks = [
				{
					ssid: 'network1',
					security: 'WPA2_PSK',
					signal_level: -50,
					channel: 6,
					unsecure: true,
					mac: ''
				}];
			const wifiCommands = new WiFiCommands({ ui });
			ui.prompt = sinon.stub();
			ui.prompt.resolves({ network: 'network1' });

			const result = await wifiCommands._promptToSelectNetwork(networks);

			expect(result).to.eql({ ssid: 'network1', security: 'WPA2_PSK', password: undefined });
		});

		it('asks for password if network is not unsecure', async () => {
			const networks = [
				{
					ssid: 'network1',
					security: 'WPA2_PSK',
					signal_level: -50,
					channel: 6,
					unsecure: false,
					mac: ''
				}];
			const wifiCommands = new WiFiCommands({ ui });
			ui.prompt = sinon.stub();
			ui.prompt.onCall(0).resolves({ network: 'network1' });
			ui.prompt.onCall(1).resolves({ password: 'password' });

			const result = await wifiCommands._promptToSelectNetwork(networks);

			expect(result).to.eql({ ssid: 'network1', security: 'WPA2_PSK', password: 'password' });
			expect(ui.prompt).to.have.been.calledTwice;
			expect(ui.prompt).to.calledWithMatch([{
				choices: sinon.match.func,
				message: 'Select the Wi-Fi network with which you wish to connect your device:',
				name: 'network',
				type: 'list',
				when: sinon.match.func
			}
			]);
			expect(ui.prompt).to.have.been.calledWith([{
				type: 'input',
				name: 'password',
				message: 'Wi-Fi Password',
				validate: sinon.match.func
			}]);
		});

		it('returns rescan if RESCAN_LABEL is selected', async () => {
			const networks = [
				{
					ssid: 'network1',
					security: 'WPA2',
					signal_level: -50,
					channel: 6,
					unsecure: true,
					mac: ''
				}];
			const wifiCommands = new WiFiCommands({ ui });
			ui.prompt = sinon.stub();
			ui.prompt.resolves({ network: '[rescan networks]' });

			const result = await wifiCommands._promptToSelectNetwork(networks);

			expect(result).to.eql({ ssid: null, rescan: true });
		});
	});

	describe('_getNetworkToConnectFromJson', () => {
		beforeEach(async () => {
			await fs.ensureDir(path.join(PATH_TMP_DIR, 'networks'));
		});
		afterEach(async () => {
			await fs.remove(path.join(PATH_TMP_DIR, 'networks'));
		});

		it('returns network from json', async () => {
			// create a file with a network
			const network = { network: 'my-network', security: 'WPA2_PSK', password: 'my-password' };
			const file = path.join(PATH_TMP_DIR, 'networks', 'network.json');
			fs.writeJsonSync(file, network);
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands.file = file;

			const result = await wifiCommands._getNetworkToConnectFromJson();

			expect(result).to.eql({ ssid: network.network, security: 'WPA2_PSK', password: network.password, hidden: undefined });
		});

		it('returns a hidden network from json', async () => {
			// create a file with a network
			const network = { network: 'my-network', security: 'WPA2_PSK', password: 'my-password', hidden: true };
			const file = path.join(PATH_TMP_DIR, 'networks', 'network.json');
			fs.writeJsonSync(file, network);
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands.file = file;

			const result = await wifiCommands._getNetworkToConnectFromJson();

			expect(result).to.eql({ ssid: network.network, security: 'WPA2_PSK', password: network.password, hidden: true });
		});

		it('throws error if file does not exist', async () => {
			const fileName = path.join(process.cwd(), 'fake-file');
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands.file = fileName;
			const expectedErrorMessage = `ENOENT: no such file or directory, open '${fileName}'`;
			let error;

			try {
				await wifiCommands._getNetworkToConnectFromJson();
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.eql(expectedErrorMessage);
		});
		it('throws an error in case the file does not contain network property', async () => {
			const network = { password: 'my-password' };
			const file = path.join(PATH_TMP_DIR, 'networks', 'network.json');
			fs.writeJsonSync(file, network);
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands.file = file;
			let error;

			try {
				await wifiCommands._getNetworkToConnectFromJson();
			} catch (_error) {
				error = _error;
			}

			expect(error.message).to.eql('No network name found in the file');
			expect(error.isUsageError).to.eql(true);
		});
	});

	describe('_scanNetworks', () => {
		it('returns a list of networks', async () => {
			const networks = [
				{
					ssid: 'network1',
					security: 'WPA2',
					rssi: -50,
					channel: 6
				}
			];
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands._deviceScanNetworks = sinon.stub().resolves(networks);

			const result = await wifiCommands._scanNetworks();

			expect(result).to.eql(networks);
		});

		it ('prompts to rescan if there are no networks', async () => {
			const wifiCommands = new WiFiCommands({ ui });
			wifiCommands._deviceScanNetworks = sinon.stub().resolves([]);
			ui.prompt = sinon.stub();
			ui.prompt.onCall(0).resolves({ rescan: true });
			ui.prompt.onCall(1).resolves({ rescan: false });

			const result = await wifiCommands._scanNetworks();

			expect(result).to.eql([]);
			expect(ui.prompt).to.have.been.calledWith([{
				default: true,
				message: 'No networks found. Try again?',
				type: 'confirm',
				name: 'rescan',
			}]);
		});
	});

	describe('_getNetworkToConnect', () => {
		it('returns network from prompt', async () => {
			const networks = [
				{
					ssid: 'network1',
					security: 'WPA2',
					signal_level: -50,
					channel: 6,
					unsecure: true,
					mac: ''
				}];
			const wifiCommands = new WiFiCommands('deviceId', { ui, newSpin, stopSpin });
			wifiCommands._promptForScanNetworks = sinon.stub().resolves(true);
			wifiCommands._scanNetworks = sinon.stub().resolves(networks);
			wifiCommands._promptToSelectNetwork = sinon.stub().resolves({ ssid: 'network1', password: 'password' });

			const result = await wifiCommands._getNetworkToConnect();

			expect(result).to.eql({ ssid: 'network1', password: 'password' });
		});

		it('returns network from manual input', async () => {
			const wifiCommands = new WiFiCommands('deviceId', { ui, newSpin, stopSpin });
			wifiCommands._promptForScanNetworks = sinon.stub().resolves(false);
			wifiCommands._pickNetworkManually = sinon.stub().resolves({ ssid: 'network1', password: 'password' });

			const result = await wifiCommands._getNetworkToConnect();

			expect(result).to.eql({ ssid: 'network1', password: 'password' });
		});
	});

	describe('joinWifi', () => {
		it('joins a Wi-Fi network', async () => {
			const wifiCommands = new WiFiCommands({ ui });
			usbUtils.getOneUsbDevice.resolves(openDevice);
			openDevice.joinNewWifiNetwork.resolves();
			wifiCommands.device = openDevice;
			const networkInput = { ssid: 'network1', security: 'WPA2_PSK', password: 'password', hidden: undefined };

			const result = await wifiCommands.joinWifi(networkInput);

			expect(result).to.be.undefined;
			expect(openDevice.joinNewWifiNetwork).to.have.been.calledOnce;
			expect(openDevice.joinNewWifiNetwork).to.have.been.calledWith(networkInput);
		});

		it('throws an error if joining the Wi-Fi network fails', async () => {
			const wifiCommands = new WiFiCommands({ ui });
			const networkInput = { ssid: 'network1', security: 'WPA2_PSK', password: 'password' };
			openDevice.joinNewWifiNetwork.rejects(new Error('Join failed'));
			usbUtils.getOneUsbDevice.resolves(openDevice);
			wifiCommands.device = openDevice;

			let error;
			try {
				await wifiCommands.joinWifi(networkInput);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal(`Unable to join Wi-Fi network 'network1': Join failed${os.EOL}`);
		});

	});

	describe('_withDevice', () => {
		let wifiCommands;
		let fn;

		beforeEach(() => {
			wifiCommands = new WiFiCommands({ ui });
			fn = sinon.stub();
		});

		it('opens the device and calls the provided function', async () => {
			const device = {
				isOpen: false,
				platformId: 35,
				_id: 'deviceId'
			};
			usbUtils.getOneUsbDevice.resolves(device);
			wifiCommands.device = device;
			fn.resolves();

			await wifiCommands._withDevice(fn);

			expect(usbUtils.getOneUsbDevice).to.have.been.calledOnce;
			expect(usbUtils.getOneUsbDevice).to.have.been.calledWith({
				api: wifiCommands.api,
				idOrName: null, // FIX THIS
				ui
			});
			expect(fn).to.have.been.calledOnce;
		});

		it('throws an error if the device does not support Wi-Fi', async () => {
			const device = {
				isOpen: false,
				platformId: 13,
				_id: 'deviceId'
			};
			usbUtils.getOneUsbDevice.resolves(device);

			let error;
			try {
				await wifiCommands._withDevice(fn);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('This device (deviceId / boron) does not support Wi-Fi.\n');
		});

		it('throws an error if the device does not support the "particle wifi" commands', async () => {
			const device = {
				isOpen: false,
				platformId: 6,
				_id: 'deviceId'
			};
			usbUtils.getOneUsbDevice.resolves(device);

			try {
				await wifiCommands._withDevice(fn);
			} catch (error) {
				expect(error.message).to.equal(`The 'particle wifi' commands are not supported on this device (deviceId / photon).${os.EOL}Use 'particle serial wifi' instead.${os.EOL}`);
			}
		});

		it('calls the provided function if the device is already open', async () => {
			const device = {
				isOpen: true,
				_id: 'deviceId',
				close: sinon.stub()
			};
			wifiCommands.device = device;
			fn.resolves();

			await wifiCommands._withDevice(fn);

			expect(fn).to.have.been.calledOnce;
		});

		it('closes the device after calling the provided function', async () => {
			const device = {
				isOpen: true,
				platformId: 35,
				_id: 'deviceId',
				close: sinon.stub()
			};
			usbUtils.getOneUsbDevice.resolves(device);
			fn.resolves();

			await wifiCommands._withDevice(fn);

			expect(device.close).to.have.been.calledOnce;
		});

		it('throws an error if the provided function throws an error', async () => {
			const device = {
				isOpen: false,
				platformId: 35,
				_id: 'deviceId'
			};
			usbUtils.getOneUsbDevice.resolves(device);
			fn.rejects(new Error('Function error'));

			try {
				await wifiCommands._withDevice(fn);
			} catch (error) {
				expect(error.message).to.equal('Function error');
			}
		});
	});

	describe('_getActionStringFromOp', () => {
		it('converts an operation name to a verb form', () => {
			const wifiCommands = new WiFiCommands('deviceId', { ui, newSpin, stopSpin });
			const operationName = 'Adding Wi-Fi network';
			const expected = 'add Wi-Fi network';

			const result = wifiCommands._getActionStringFromOp(operationName);

			expect(result).to.equal(expected);
		});
	});

	describe('_performWifiOperation', () => {
		let wifiCommands;
		let operationCallback;

		beforeEach(() => {
			wifiCommands = new WiFiCommands({ ui });
			wifiCommands.device = {
				isOpen: false,
				platformId: 35,
				_id: 'deviceId'
			};
			operationCallback = sinon.stub();
		});

		it('returns true if operationCallback returns a replyObject', async () => {
			const replyObject = { foo: 'bar' };
			operationCallback.resolves(replyObject);

			const result = await wifiCommands._performWifiOperation('Test Operation', operationCallback);

			expect(result).to.eql(replyObject);
			expect(operationCallback).to.have.been.calledOnce;
		});

		it('throws an error if operationCallback throws an error with message "Not supported"', async () => {
			operationCallback.rejects(new Error('Random Error'));

			let error;
			try {
				await wifiCommands._performWifiOperation('Test Operation', operationCallback);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Unable to test Operation: Random Error\n');
		});
	});

	describe('_handleDeviceError', () => {
		it('returns an error with the appropriate message and helper string for "Invalid state" error', () => {
			const wifiCommands = new WiFiCommands({ ui });
			const error = { name: 'Invalid state', message: 'Invalid state', cause: false };

			const result = wifiCommands._handleDeviceError(error, { action: 'join wi-fi network' });

			expect(result).to.be.an.instanceOf(Error);
			expect(result.message).to.include('Unable to join wi-fi network: Invalid state');
		});

		it('returns an error with the appropriate message and helper string for "Not found" error', () => {
			const wifiCommands = new WiFiCommands('deviceId', { ui, newSpin, stopSpin });
			const error = { name: 'Not found', message: 'Not found', cause: false };

			const result = wifiCommands._handleDeviceError(error, { action: 'join wi-fi network' });

			expect(result).to.be.an.instanceOf(Error);
			expect(result.message).to.equal(`Unable to join wi-fi network: Not found${os.EOL}If you are using a hidden network, please add the hidden network credentials first using 'particle wifi add'.`);
		});

		it('returns an error with the appropriate message and helper string for "Not supported" error', () => {
			const wifiCommands = new WiFiCommands('deviceId', { ui, newSpin, stopSpin });
			const error = { name: 'Not supported', message: 'Not supported', cause: false };

			const resultError = wifiCommands._handleDeviceError(error, { action: 'join wi-fi network' });

			expect(resultError).to.be.an.instanceOf(Error);
			expect(resultError.message).to.include(`Unable to join wi-fi network: Not supported${os.EOL}This feature is likely not supported on this firmware version.\nUpdate to device-os 6.2.0 or use 'particle wifi join --help' to join a network.\nAlternatively, check 'particle serial wifi'.${os.EOL}`);
		});

		it('returns an error without a helper string for unknown error messages', () => {
			const wifiCommands = new WiFiCommands('deviceId', { ui, newSpin, stopSpin });
			const error = { name: 'Unknown error', message: 'Unknown error', cause: false };

			const result = wifiCommands._handleDeviceError(error, { action: 'join wi-fi network' });

			expect(result).to.be.an.instanceOf(Error);
			expect(result.message).to.equal(`Unable to join wi-fi network: Unknown error${os.EOL}`);
		});
	});

});
