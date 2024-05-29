const { expect, sinon } = require('../../test/setup');
const WifiControlRequest = require('./wifi-control-request');
const usbUtil = require('../cmd/usb-util');
const utilities = require('./utilities');
const fs = require('fs-extra');
const path = require('path');
const { PATH_TMP_DIR } = require('../../test/lib/env');

describe('Wifi Control Request', () => {
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
			joinNewWifiNetwork: sinon.stub()
		};
		usbUtil.getOneUsbDevice = sinon.stub();
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
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });

			const result = wifiControlRequest._serializeNetworks(networks);
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
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			ui.prompt = sinon.stub();
			ui.prompt.onCall(0).returns({ ssid: 'ssid' }).onCall(1).returns({ password: 'password' });

			const result = await wifiControlRequest._pickNetworkManually();
			expect(result).to.eql({ ssid: 'ssid', password: 'password' });
			expect(ui.prompt).to.have.been.calledTwice;
			expect(ui.prompt.firstCall).to.have.been.calledWith([{
				type: 'input',
				name: 'ssid',
				message: 'SSID',
				validate: sinon.match.func,
				filter: sinon.match.func
			}]);
			expect(ui.prompt.secondCall).to.have.been.calledWith([{
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
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const result = wifiControlRequest._filterNetworks(networks);
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
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const networks = await wifiControlRequest._deviceScanNetworks();
			expect(networks).to.eql([{
				ssid: 'network1',
				security: 'WPA2',
				signal_level: -50,
				channel: '6',
				unsecure: false,
				mac: ''
			}]);
			expect(usbUtil.getOneUsbDevice).to.have.been.calledOnce;
			expect(usbUtil.getOneUsbDevice).to.have.been.calledWith({
				api: sinon.match.object,
				idOrName: 'deviceId', ui
			});
		});
		it('throws an error if fails after retrying', async () => {
			openDevice.scanWifiNetworks.rejects(new Error('error'));
			usbUtil.getOneUsbDevice.resolves(openDevice);
			let error;
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			try {
				await wifiControlRequest._deviceScanNetworks({ customRetryCount: 1 });
			} catch (_error) {
				error = _error;
			}

			expect(error.message).to.eql('Unable to scan for Wi-Fi networks: error');
			expect(usbUtil.getOneUsbDevice).to.have.been.calledOnce;
			expect(usbUtil.getOneUsbDevice).to.have.been.calledWith({
				api: sinon.match.object,
				idOrName: 'deviceId', ui
			});
			expect(utilities.delay).to.have.been.calledWith(1000);
		});
		it('close the device after scanning', async () => {
			openDevice.scanWifiNetworks.resolves([{
				ssid: 'network1',
				security: 'WPA2',
				rssi: -50,
				channel: 6
			}]);
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			await wifiControlRequest._deviceScanNetworks();
			expect(openDevice.close).to.have.been.calledOnce;
		});

		it('returns empty if there is no networks', async () => {
			openDevice.scanWifiNetworks.resolves([]);
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const networks = await wifiControlRequest._deviceScanNetworks();
			expect(networks).to.eql([]);
			expect(usbUtil.getOneUsbDevice).to.have.been.calledOnce;
			expect(usbUtil.getOneUsbDevice).to.have.been.calledWith({
				api: sinon.match.object,
				idOrName: 'deviceId', ui
			});
		});
	});

	describe('_promptToSelectNetwork', () => {
		it('prompts to select a network', async () => {
			const networks = [
				{
					ssid: 'network1',
					security: 'WPA2',
					signal_level: -50,
					channel: 6,
					unsecure: true,
					mac: ''
				}];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			ui.prompt = sinon.stub();
			ui.prompt.resolves({ network: 'network1' });
			const result = await wifiControlRequest._promptToSelectNetwork(networks);
			expect(result).to.eql({ ssid: 'network1', password: undefined });
		});

		it('asks for password if network is not unsecure', async () => {
			const networks = [
				{
					ssid: 'network1',
					security: 'WPA2',
					signal_level: -50,
					channel: 6,
					unsecure: false,
					mac: ''
				}];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			ui.prompt = sinon.stub();
			ui.prompt.onCall(0).resolves({ network: 'network1' });
			ui.prompt.onCall(1).resolves({ password: 'password' });
			const result = await wifiControlRequest._promptToSelectNetwork(networks);
			expect(result).to.eql({ ssid: 'network1', password: 'password' });
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
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			ui.prompt = sinon.stub();
			ui.prompt.resolves({ network: '[rescan networks]' });
			const result = await wifiControlRequest._promptToSelectNetwork(networks);
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
			const network = { network: 'my-network', password: 'my-password' };
			const file = path.join(PATH_TMP_DIR, 'networks', 'network.json');
			fs.writeJsonSync(file, network);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin, file });
			const result = await wifiControlRequest._getNetworkToConnect();
			expect(result).to.eql({ ssid: network.network, password: network.password });
		});
		it('throws error if file does not exist', async () => {
			const fileName = path.join(process.cwd(), 'fake-file');
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin, file: fileName });
			let expectedErrorMessage = `ENOENT: no such file or directory, open '${fileName}'`;
			try {
				await wifiControlRequest._getNetworkToConnect();
			} catch (error) {
				expect(error.message).to.eql(expectedErrorMessage);
			}
		});
		it('throws an error in case the file does not contain network property', async () => {
			const network = { password: 'my-password' };
			const file = path.join(PATH_TMP_DIR, 'networks', 'network.json');
			let error;
			fs.writeJsonSync(file, network);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin, file });
			try {
				await wifiControlRequest._getNetworkToConnect();
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
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._deviceScanNetworks = sinon.stub().resolves(networks);
			const result = await wifiControlRequest._scanNetworks();
			expect(result).to.eql(networks);
		});

		it ('prompts to rescan if there are no networks', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._deviceScanNetworks = sinon.stub().resolves([]);
			ui.prompt = sinon.stub();
			ui.prompt.onCall(0).resolves({ rescan: true });
			ui.prompt.onCall(1).resolves({ rescan: false });
			const result = await wifiControlRequest._scanNetworks();
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
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._promptForScanNetworks = sinon.stub().resolves(true);
			wifiControlRequest._scanNetworks = sinon.stub().resolves(networks);
			wifiControlRequest._promptToSelectNetwork = sinon.stub().resolves({ ssid: 'network1', password: 'password' });
			const result = await wifiControlRequest._getNetworkToConnect();
			expect(result).to.eql({ ssid: 'network1', password: 'password' });
		});

		it('returns network from manual input', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._promptForScanNetworks = sinon.stub().resolves(false);
			wifiControlRequest._pickNetworkManually = sinon.stub().resolves({ ssid: 'network1', password: 'password' });
			const result = await wifiControlRequest._getNetworkToConnect();
			expect(result).to.eql({ ssid: 'network1', password: 'password' });
		});
	});

	describe('configureWifi', () => {
		it('performs the wifi configuration flow', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._getNetworkToConnect = sinon.stub().resolves({ ssid: 'network1', password: 'password' });
			wifiControlRequest._getNetworkToConnect = sinon.stub();
			wifiControlRequest.joinWifi = sinon.stub().resolves(true);
			await wifiControlRequest.configureWifi();
			expect(wifiControlRequest._getNetworkToConnect).to.have.been.calledOnce;
			expect(wifiControlRequest.joinWifi).to.have.been.calledOnce;
			expect(wifiControlRequest._getNetworkToConnect).not.to.have.been.called;
		});

		it('performs the wifi configuration flow from json', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin, file: 'file' });
			wifiControlRequest._getNetworkToConnect = sinon.stub();
			wifiControlRequest._getNetworkToConnect = sinon.stub().resolves({ ssid: 'network1', password: 'password' });
			wifiControlRequest.joinWifi = sinon.stub().resolves(true);
			await wifiControlRequest.configureWifi();
			expect(wifiControlRequest._getNetworkToConnect).not.to.have.been.called;
			expect(wifiControlRequest.joinWifi).to.have.been.calledOnce;
			expect(wifiControlRequest._getNetworkToConnect).to.have.been.calledOnce;
		});
	});

	
});

describe('Wifi Control Request', () => {
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
			start: sinon.stub().callsFake(() => { }),
			stop: sinon.stub()
		});
		stopSpin = sinon.stub();
		openDevice = {
			deviceId: 'deviceId',
			isOpen: true,
			close: sinon.stub(),
			reset: sinon.stub(),
			scanWifiNetworks: sinon.stub(),
			joinNewWifiNetwork: sinon.stub()
		};
		usbUtil.getOneUsbDevice = sinon.stub();
	});
	afterEach(() => {
		sinon.restore();
	});

	describe('_serializeNetworks', () => {
		it('returns a list of networks', () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signal_level: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signal_level: -60, channel: 11 }
			];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const result = wifiControlRequest._serializeNetworks(networks);
			expect(result).to.eql([
				{ ssid: 'network1', security: 'WPA2', signalLevel: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signalLevel: -60, channel: 11 }
			]);
		});
	});

	describe('_pickNetworkManually', () => {
		it('prompts for ssid and password', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			ui.prompt = sinon.stub();
			ui.prompt.onCall(0).resolves({ ssid: 'network1' });
			ui.prompt.onCall(1).resolves({ password: 'password' });
			const result = await wifiControlRequest._pickNetworkManually();
			expect(result).to.eql({ ssid: 'network1', password: 'password' });
			expect(ui.prompt).to.have.been.calledTwice;
			expect(ui.prompt).to.have.been.calledWith([
				{ type: 'input', name: 'ssid', message: 'Wi-Fi SSID' }
			]);
			expect(ui.prompt).to.have.been.calledWith([
				{ type: 'password', name: 'password', message: 'Wi-Fi Password' }
			]);
		});
	});

	describe('_filterNetworks', () => {
		it('filters out and remove null, undefined and 5GHZ networks', () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signal_level: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signal_level: -60, channel: 11 },
				{ ssid: 'network3', security: 'WPA2', signal_level: -70, channel: 36 },
				{ ssid: null, security: 'WPA2', signal_level: -80, channel: 1 },
				{ ssid: 'network5', security: 'WPA2', signal_level: -90, channel: 6, frequency: '5GHZ' },
				{ ssid: 'network6', security: 'WPA2', signal_level: -100, channel: 6, frequency: '5GHZ' }
			];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const result = wifiControlRequest._filterNetworks(networks);
			expect(result).to.eql([
				{ ssid: 'network1', security: 'WPA2', signalLevel: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signalLevel: -60, channel: 11 },
				{ ssid: 'network3', security: 'WPA2', signalLevel: -70, channel: 36 }
			]);
		});
	});

	describe('_deviceScanNetworks', () => {
		it('returns a list of networks from a particle device', async () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signal_level: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signal_level: -60, channel: 11 }
			];
			openDevice.scanWifiNetworks.resolves(networks);
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const result = await wifiControlRequest._deviceScanNetworks();
			expect(result).to.eql([
				{ ssid: 'network1', security: 'WPA2', signalLevel: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signalLevel: -60, channel: 11 }
			]);
			expect(usbUtil.getOneUsbDevice).to.have.been.calledOnce;
			expect(usbUtil.getOneUsbDevice).to.have.been.calledWith({
				api: sinon.match.object,
				idOrName: 'deviceId',
				ui
			});
			expect(openDevice.scanWifiNetworks).to.have.been.calledOnce;
		});

		it('throws an error if fails after retrying', async () => {
			openDevice.scanWifiNetworks.rejects(new Error('Scan failed'));
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			try {
				await wifiControlRequest._deviceScanNetworks();
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('Scan failed');
				expect(usbUtil.getOneUsbDevice).to.have.been.calledOnce;
				expect(usbUtil.getOneUsbDevice).to.have.been.calledWith({
					api: sinon.match.object,
					idOrName: 'deviceId',
					ui
				});
				expect(openDevice.scanWifiNetworks).to.have.callCount(RETRY_COUNT + 1);
			}
		});

		it('closes the device after scanning', async () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signal_level: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signal_level: -60, channel: 11 }
			];
			openDevice.scanWifiNetworks.resolves(networks);
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			await wifiControlRequest._deviceScanNetworks();
			expect(openDevice.close).to.have.been.calledOnce;
		});

		it('returns an empty array if there are no networks', async () => {
			openDevice.scanWifiNetworks.resolves([]);
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const result = await wifiControlRequest._deviceScanNetworks();
			expect(result).to.eql([]);
			expect(usbUtil.getOneUsbDevice).to.have.been.calledOnce;
			expect(usbUtil.getOneUsbDevice).to.have.been.calledWith({
				api: sinon.match.object,
				idOrName: 'deviceId',
				ui
			});
			expect(openDevice.scanWifiNetworks).to.have.been.calledOnce;
		});
	});

	describe('_promptToSelectNetwork', () => {
		it('prompts to select a network', async () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signalLevel: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signalLevel: -60, channel: 11 }
			];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			ui.prompt = sinon.stub();
			ui.prompt.resolves({ network: 'network1' });
			const result = await wifiControlRequest._promptToSelectNetwork(networks);
			expect(result).to.eql({ ssid: 'network1', password: undefined });
			expect(ui.prompt).to.have.been.calledOnce;
			expect(ui.prompt).to.have.been.calledWith([
				{
					choices: sinon.match.func,
					message: 'Select the Wi-Fi network with which you wish to connect your device:',
					name: 'network',
					type: 'list',
					when: sinon.match.func
				}
			]);
		});

		it('asks for password if network is not unsecure', async () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signalLevel: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signalLevel: -60, channel: 11 }
			];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			ui.prompt = sinon.stub();
			ui.prompt.onCall(0).resolves({ network: 'network1' });
			ui.prompt.onCall(1).resolves({ password: 'password' });
			const result = await wifiControlRequest._promptToSelectNetwork(networks);
			expect(result).to.eql({ ssid: 'network1', password: 'password' });
			expect(ui.prompt).to.have.been.calledTwice;
			expect(ui.prompt).to.have.been.calledWith([
				{
					choices: sinon.match.func,
					message: 'Select the Wi-Fi network with which you wish to connect your device:',
					name: 'network',
					type: 'list',
					when: sinon.match.func
				}
			]);
			expect(ui.prompt).to.have.been.calledWith([
				{ type: 'password', name: 'password', message: 'Wi-Fi Password' }
			]);
		});

		it('returns rescan if RESCAN_LABEL is selected', async () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signalLevel: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signalLevel: -60, channel: 11 }
			];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			ui.prompt = sinon.stub();
			ui.prompt.resolves({ network: RESCAN_LABEL });
			const result = await wifiControlRequest._promptToSelectNetwork(networks);
			expect(result).to.eql({ ssid: null, rescan: true });
			expect(ui.prompt).to.have.been.calledOnce;
			expect(ui.prompt).to.have.been.calledWith([
				{
					choices: sinon.match.func,
					message: 'Select the Wi-Fi network with which you wish to connect your device:',
					name: 'network',
					type: 'list',
					when: sinon.match.func
				}
			]);
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
			const network = { ssid: 'my-network', password: 'my-password' };
			const file = path.join(PATH_TMP_DIR, 'networks', 'network.json');
			fs.writeJsonSync(file, network);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin, file });
			const result = await wifiControlRequest._getNetworkToConnectFromJson();
			expect(result).to.eql({ ssid: network.ssid, password: network.password });
		});

		it('throws an error if file does not exist', async () => {
			const fileName = path.join(process.cwd(), 'fake-file');
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin, file: fileName });
			try {
				await wifiControlRequest._getNetworkToConnectFromJson();
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal(`ENOENT: no such file or directory, open '${fileName}'`);
			}
		});

		it('throws an error if the file does not contain the network property', async () => {
			const network = { password: 'my-password' };
			const file = path.join(PATH_TMP_DIR, 'networks', 'network.json');
			fs.writeJsonSync(file, network);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin, file });
			try {
				await wifiControlRequest._getNetworkToConnectFromJson();
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('No network name found in the file');
				expect(error.isUsageError).to.be.true;
			}
		});
	});

	describe('_scanNetworks', () => {
		it('returns a list of networks', async () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signalLevel: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signalLevel: -60, channel: 11 }
			];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._deviceScanNetworks = sinon.stub().resolves(networks);
			const result = await wifiControlRequest._scanNetworks();
			expect(result).to.eql(networks);
			expect(wifiControlRequest._deviceScanNetworks).to.have.been.calledOnce;
		});

		it('prompts to rescan if there are no networks', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._deviceScanNetworks = sinon.stub().resolves([]);
			ui.prompt = sinon.stub();
			ui.prompt.onCall(0).resolves({ rescan: true });
			ui.prompt.onCall(1).resolves({ rescan: false });
			const result = await wifiControlRequest._scanNetworks();
			expect(result).to.eql([]);
			expect(ui.prompt).to.have.been.calledOnce;
			expect(ui.prompt).to.have.been.calledWith([
				{
					default: true,
					message: 'No networks found. Try again?',
					type: 'confirm',
					name: 'rescan'
				}
			]);
		});
	});

	describe('_getNetworkToConnect', () => {
		it('returns network from prompt', async () => {
			const networks = [
				{ ssid: 'network1', security: 'WPA2', signalLevel: -50, channel: 6 },
				{ ssid: 'network2', security: 'WPA2', signalLevel: -60, channel: 11 }
			];
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._promptForScanNetworks = sinon.stub().resolves(true);
			wifiControlRequest._scanNetworks = sinon.stub().resolves(networks);
			wifiControlRequest._promptToSelectNetwork = sinon.stub().resolves({ ssid: 'network1', password: 'password' });
			const result = await wifiControlRequest._getNetworkToConnect();
			expect(result).to.eql({ ssid: 'network1', password: 'password' });
			expect(wifiControlRequest._promptForScanNetworks).to.have.been.calledOnce;
			expect(wifiControlRequest._scanNetworks).to.have.been.calledOnce;
			expect(wifiControlRequest._promptToSelectNetwork).to.have.been.calledOnce;
		});

		it('returns network from manual input', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._promptForScanNetworks = sinon.stub().resolves(false);
			wifiControlRequest._pickNetworkManually = sinon.stub().resolves({ ssid: 'network1', password: 'password' });
			const result = await wifiControlRequest._getNetworkToConnect();
			expect(result).to.eql({ ssid: 'network1', password: 'password' });
			expect(wifiControlRequest._promptForScanNetworks).to.have.been.calledOnce;
			expect(wifiControlRequest._pickNetworkManually).to.have.been.calledOnce;
		});
	});

	describe('joinWifi', () => {
		it('joins a Wi-Fi network', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._getNetworkToConnect = sinon.stub().resolves({ ssid: 'network1', password: 'password' });
			openDevice.joinNewWifiNetwork.resolves();
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const result = await wifiControlRequest.joinWifi();
			expect(result).to.be.true;
			expect(usbUtil.getOneUsbDevice).to.have.been.calledOnce;
			expect(usbUtil.getOneUsbDevice).to.have.been.calledWith({
				api: sinon.match.object,
				idOrName: 'deviceId',
				ui
			});
			expect(openDevice.joinNewWifiNetwork).to.have.been.calledOnce;
			expect(openDevice.joinNewWifiNetwork).to.have.been.calledWith('network1', 'password');
		});

		it('throws an error if joining the Wi-Fi network fails', async () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			wifiControlRequest._getNetworkToConnect = sinon.stub().resolves({ ssid: 'network1', password: 'password' });
			openDevice.joinNewWifiNetwork.rejects(new Error('Join failed'));
			usbUtil.getOneUsbDevice.resolves(openDevice);
			try {
				await wifiControlRequest.joinWifi();
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('Join failed');
			}
		});

	});

	describe('_withDevice', () => {
		let wifiControlRequest;
		let fn;

		beforeEach(() => {
			wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			fn = sinon.stub();
		});

		it('opens the device and calls the provided function', async () => {
			const device = {
				isOpen: false,
				platformId: '123',
				_id: 'deviceId'
			};
			usbUtils.getOneUsbDevice.resolves(device);
			fn.resolves();

			await wifiControlRequest._withDevice(fn);

			expect(usbUtils.getOneUsbDevice).to.have.been.calledOnce;
			expect(usbUtils.getOneUsbDevice).to.have.been.calledWith({
				api: wifiControlRequest.api,
				idOrName: 'deviceId',
				ui
			});
			expect(fn).to.have.been.calledOnce;
		});

		it('throws an error if the device does not support Wi-Fi', async () => {
			const device = {
				isOpen: false,
				platformId: '123',
				_id: 'deviceId'
			};
			usbUtils.getOneUsbDevice.resolves(device);
			platformForId.withArgs('123').returns({ generation: 3, name: 'boron', features: ['cellular'] });

			try {
				await wifiControlRequest._withDevice(fn);
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('This device (deviceId / boron) does not support Wi-Fi.\n');
			}
		});

		it('throws an error if the device does not support the "particle wifi" commands', async () => {
			const device = {
				isOpen: false,
				platformId: '123',
				_id: 'deviceId'
			};
			usbUtils.getOneUsbDevice.resolves(device);
			platformForId.withArgs('123').returns({ generation: 2, name: 'Photon', features: ['wifi'] });

			try {
				await wifiControlRequest._withDevice(fn);
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('The \'particle wifi\' commands are not supported on this device (deviceId / Photon).\nUse \'particle serial wifi\' instead.\n');
			}
		});

		it('calls the provided function if the device is already open', async () => {
			const device = {
				isOpen: true,
				_id: 'deviceId'
			};
			wifiControlRequest.device = device;
			fn.resolves();

			await wifiControlRequest._withDevice(fn);

			expect(fn).to.have.been.calledOnce;
		});

		it('closes the device after calling the provided function', async () => {
			const device = {
				isOpen: false,
				platformId: '123',
				_id: 'deviceId',
				close: sinon.stub()
			};
			usbUtils.getOneUsbDevice.resolves(device);
			fn.resolves();

			await wifiControlRequest._withDevice(fn);

			expect(device.close).to.have.been.calledOnce;
		});

		it('throws an error if the provided function throws an error', async () => {
			const device = {
				isOpen: false,
				platformId: '123',
				_id: 'deviceId'
			};
			usbUtils.getOneUsbDevice.resolves(device);
			fn.rejects(new Error('Function error'));

			try {
				await wifiControlRequest._withDevice(fn);
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('Function error');
			}
		});
	});

	describe('_getActionStringFromOp', () => {
		it('converts an operation name to a verb form', () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const operationName = 'Adding Wi-Fi network';
			const expected = 'add Wi-Fi network';
			const result = wifiControlRequest._getActionStringFromOp(operationName);
			expect(result).to.equal(expected);
		});
	});

	describe('_performWifiOperation', () => {
		let wifiControlRequest;
		let operationCallback;
		
		beforeEach(() => {
			wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			operationCallback = sinon.stub();
		});
		
		it('returns true if operationCallback returns a result with pass', async () => {
			operationCallback.resolves({ pass: true });
			
			const result = await wifiControlRequest._performWifiOperation('Test Operation', operationCallback);
			
			expect(result).to.be.true;
			expect(operationCallback).to.have.been.calledOnce;
		});
		
		it('returns replyObject if operationCallback returns a result with pass and replyObject', async () => {
			// const replyObject = { networks: [
			// 	{
			// 		ssid: 'Network1',
			// 		bssid: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]),
			// 		channel: 11,
			// 		rssi: -80
			// 	},
			// 	{
			// 		ssid: 'Network2',
			// 		bssid: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x07]),
			// 		channel: 11,
			// 		rssi: -90
			// 	}
			// ]};
			const replyObject = { foo: 'bar' };

			operationCallback.resolves({ pass: true, replyObject });
			
			const result = await wifiControlRequest._performWifiOperation('Test Operation', operationCallback);
			
			expect(result).to.eql(replyObject);
			expect(operationCallback).to.have.been.calledOnce;
		});
		
		it('throws an error if operationCallback throws an error with message "Not supported"', async () => {
			const error = new Error('Not supported');
			operationCallback.rejects(error);
			
			try {
				await wifiControlRequest._performWifiOperation('Test Operation', operationCallback);
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('Unable to perform Test Operation: Not supported');
				expect(error.helperString).to.be.undefined;
			}
			
			expect(operationCallback).to.have.been.calledOnce;
		});
		
		it('throws an error if operationCallback throws an error other than "Not supported"', async () => {
			const error = new Error('Some error');
			operationCallback.rejects(error);
			
			try {
				await wifiControlRequest._performWifiOperation('Test Operation', operationCallback);
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('Unable to perform Test Operation: Some error');
				expect(error.helperString).to.be.undefined;
			}
			
			expect(operationCallback).to.have.callCount(RETRY_COUNT);
			expect(utilities.delay).to.have.callCount(RETRY_COUNT - 1);
		});
		
		it('throws an error if operationCallback returns a result with error', async () => {
			const error = new Error('Some error');
			operationCallback.resolves({ error });
			
			try {
				await wifiControlRequest._performWifiOperation('Test Operation', operationCallback);
				expect.fail('Expected an error to be thrown');
			} catch (error) {
				expect(error.message).to.equal('Unable to perform Test Operation: Some error');
				expect(error.helperString).to.be.undefined;
			}
			
			expect(operationCallback).to.have.been.calledOnce;
		});
	});

	describe('_handleDeviceError', () => {
		it('returns an error with "Request timed out" message', () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const error = wifiControlRequest._handleDeviceError('Request timed out', { action: 'join wi-fi network' });
			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Unable to join wi-fi network: Request timed out');
		});

		it('returns an error with the appropriate message and helper string for "Invalid state" error', () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const error = { name: 'Invalid state', message: 'Invalid state', cause: true };
			const result = wifiControlRequest._handleDeviceError(error, { action: 'join wi-fi network' });
			expect(result).to.be.an.instanceOf(Error);
			expect(result.message).to.equal('Unable to join wi-fi network: Invalid state');
			expect(result.helperString).to.equal('Please ensure your device is in listening mode (blinking blue) before attempting to configure Wi-Fi.');
		});

		it('returns an error with the appropriate message and helper string for "Not found" error', () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const error = { name: 'Not found', message: 'Not found', cause: true };
			const result = wifiControlRequest._handleDeviceError(error, { action: 'join wi-fi network' });
			expect(result).to.be.an.instanceOf(Error);
			expect(result.message).to.equal('Unable to join wi-fi network: Not found');
			expect(result.helperString).to.equal("If you are using a hidden network, please add the hidden network credentials first using 'particle wifi add'.");
		});

		it('returns an error with the appropriate message and helper string for "Not supported" error', () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const error = { name: 'Not supported', message: 'Not supported', cause: true };
			const result = wifiControlRequest._handleDeviceError(error, { action: 'join wi-fi network' });
			expect(result).to.be.an.instanceOf(Error);
			expect(result.message).to.equal('Unable to join wi-fi network: Not supported');
			expect(result.helperString).to.equal("This feature is not supported on this firmware version.\nUpdate to device-os 6.2.0 or use 'particle wifi join --help' to join a network.\nAlternatively, check 'particle serial wifi'.\n");
		});

		it('returns an error without a helper string for unknown error messages', () => {
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			const error = { name: 'Unknown error', message: 'Unknown error', cause: true };
			const result = wifiControlRequest._handleDeviceError(error, { action: 'join wi-fi network' });
			expect(result).to.be.an.instanceOf(Error);
			expect(result.message).to.equal('Unable to join wi-fi network: Unknown error');
			expect(result.helperString).to.equal('');
		});
	});
});