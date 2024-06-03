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

	describe('_getNetworkToConnect', () => {
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

	describe('joinWifi', () => {
		it('joins a network', async () => {
			openDevice.joinNewWifiNetwork.resolves({ pass: true });
			usbUtil.getOneUsbDevice.resolves(openDevice);
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			await wifiControlRequest.joinWifi({ ssid: 'network1', password: 'password' });
			expect(openDevice.joinNewWifiNetwork).to.have.been.calledOnce;
			expect(openDevice.joinNewWifiNetwork).to.have.been.calledWith({ ssid: 'network1', password: 'password' }, { timeout: 30000 });
			expect(newSpin).to.have.been.calledWith('Joining Wi-Fi network \'network1\'');
			expect(stopSpin).to.have.been.calledOnce;
			expect(ui.stdout.write).to.have.been.calledWith('Wi-Fi network configured successfully, your device should now restart.');
		});

		it('throw error if fails', async () => {
			openDevice.joinNewWifiNetwork.rejects(new Error('error'));
			usbUtil.getOneUsbDevice.resolves(openDevice);
			let error;
			const wifiControlRequest = new WifiControlRequest('deviceId', { ui, newSpin, stopSpin });
			try {
				await wifiControlRequest.joinWifi({ ssid: 'network1', password: 'password' });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.eql('Unable to join Wi-Fi network: error');
			expect(openDevice.joinNewWifiNetwork).to.have.been.calledWith({ ssid: 'network1', password: 'password' }, { timeout: 30000 });
			expect(newSpin).to.have.been.calledWith('Joining Wi-Fi network \'network1\'');
			expect(stopSpin).to.have.been.calledOnce;
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
