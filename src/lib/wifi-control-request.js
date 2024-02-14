const usbUtils = require('../cmd/usb-util');
const inquirer = require('inquirer');
const RESCAN_LABEL = '[rescan networks]';
const fs = require('fs-extra');
const { deviceControlError } = require('./device-error-handler');
const JOIN_NETWORK_TIMEOUT = 30000;
const TIME_BETWEEN_RETRIES = 1000;
const RETRY_COUNT = 5;
const ParticleApi = require('../cmd/api');
const settings = require('../../settings');
const createApiCache = require('./api-cache');
const utilities = require('./utilities');
const os = require('os');

module.exports = class WiFiControlRequest {
	constructor(deviceId, { ui, newSpin, stopSpin, file }) {
		const { api } = this._particleApi();
		this.deviceId = deviceId;
		this.device = null;
		this.ui = ui;
		this.newSpin = newSpin;
		this.stopSpin = stopSpin;
		this.file = file;
		this.api = api;
	}

	async configureWifi() {
		let network;
		if (this.file) {
			network = await this.getNetworkToConnectFromJson();
		} else {
			network = await this.getNetworkToConnect();
		}
		await this.joinWifi(network);
	}

	async getNetworkToConnectFromJson() {
		const { network, password } = await fs.readJSON(this.file);
		if (!network) {
			const error = new Error('No network name found in the file');
			error.isUsageError = true;
			throw error;
		}
		return { ssid: network, password };
	}

	async getNetworkToConnect({ prompt = true } = { }) {
		let scan = true;
		if (prompt) {
			scan = await this.promptForScanNetworks();
		}
		if (scan) {
			const networks = await this.scanNetworks();
			if (networks.length) {
				const network = await this.promptToSelectNetwork(networks);
				if (network?.rescan){
					return await this.getNetworkToConnect({ prompt: false });
				} else {
					return network;
				}
			} else {
				throw new Error('No Wi-Fi networks found');
			}
		}
		return this.pickNetworkManually();
	}

	async promptForScanNetworks() {
		const question = {
			type: 'confirm',
			name: 'scan',
			message: 'Would you like to scan for Wi-Fi networks?'
		};
		const ans = await this.ui.prompt([question]);
		return ans.scan;
	}

	async scanNetworks() {
		// open device by id
		const networks = await this._deviceScanNetworks();
		if (!networks.length) {
			const answers = await this.ui.prompt([{
				type: 'confirm',
				name: 'rescan',
				message: 'No networks found. Try again?',
				default: true
			}]);
			if (answers.rescan){
				return this.scanNetworks();
			}
		}
		return this._filterNetworks(networks);
	}

	_filterNetworks(networkList) {
		const networks = networkList.filter((ap) => {
			if (!ap){
				return false;
			}
			// filter out null ssid
			if (!ap.ssid){
				return false;
			}

			// channel # > 14 === 5GHz
			if (ap.channel && parseInt(ap.channel, 10) > 14){
				return false;
			}
			return true;
		});
		return networks.reduce((acc, network) => {
			if (!acc.find((n) => n.ssid === network.ssid)) {
				acc.push(network);
			}
			return acc;
		}, []);
	}

	async _deviceScanNetworks() {
		this.newSpin('Scanning for Wi-Fi networks').start();
		let retries = RETRY_COUNT;
		let lastError = null;
		while (retries > 0) {
			try {
				if (!this.device || this.device.isOpen === false) {
					this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
				}
				const networks = await this.device.scanWifiNetworks();
				this.stopSpin();
				return this._serializeNetworks(networks) || [];
			} catch (error) {
				lastError = error;
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
			} finally {
				if (this.device && this.device.isOpen) {
					await this.device.close();
				}
			}
		}
		this.stopSpin();
		throw this._handleDeviceError(lastError, { action: 'scan for Wi-Fi networks' });
	}

	async promptToSelectNetwork(networks) {
		let password;
		const questions = [
			{
				type: 'list',
				name: 'network',
				message: 'Select the Wi-Fi network with which you wish to connect your device:',
				choices: () => {
					const ns = networks.map((n) => n.ssid);
					ns.unshift(new inquirer.Separator());
					ns.unshift(RESCAN_LABEL);
					ns.unshift(new inquirer.Separator());
					return ns;
				},
				when: () => networks.length > 0
			},
		];
		const ans = await this.ui.prompt(questions);
		if (ans.network === RESCAN_LABEL) {
			return { ssid: null, rescan: true };
		}
		const network = networks.find((n) => n.ssid === ans.network);
		if (!network.unsecure) {
			password = await this._promptForPassword();
		}
		return { ssid: network.ssid, password };
	}

	async joinWifi({ ssid, password }) {
		// open device by id
		let retries = RETRY_COUNT;
		const spin = this.newSpin(`Joining Wi-Fi network '${ssid}'`).start();
		let lastError;
		while (retries > 0) {
			try {
				if (!this.device || this.device.isOpen === false) {
					this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId });
				}
				const { pass }  = await this.device.joinNewWifiNetwork({ ssid, password }, { timeout: JOIN_NETWORK_TIMEOUT });
				if (pass) {
					this.stopSpin();
					this.ui.stdout.write('Wi-Fi network configured successfully, your device should now restart.');
					this.ui.stdout.write(os.EOL);
					await this.device.reset();
					return;
				}
				retries = 0;
				lastError = new Error('Please check your credentials and try again.');
			} catch (error) {
				spin.setSpinnerTitle(`Joining Wi-Fi network '${ssid}' is taking longer than expected.`);
				lastError = error;
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
			} finally {
				if (this.device && this.device.isOpen) {
					await this.device.close();
				}
			}
		}
		this.stopSpin();
		throw this._handleDeviceError(lastError, { action: 'join Wi-Fi network' });
	}

	async pickNetworkManually() {
		const ssid = await this._promptForSSID();
		const password = await this._promptForPassword();
		return { ssid, password };
	}

	async _promptForSSID() {
		const question = {
			type: 'input',
			name: 'ssid',
			message: 'SSID',
			validate: (input) => {
				if (!input || !input.trim()) {
					return 'Please enter the SSID';
				} else {
					return true;
				}
			},
			filter: (input) => {
				return input.trim();
			}
		};

		const ans = await this.ui.prompt([question]);
		return ans.ssid;
	}

	async _promptForPassword() {
		const question = {
			type: 'input',
			name: 'password',
			message: 'Wi-Fi Password',
			validate: (input) => {
				return !!input;
			}
		};
		const ans = await this.ui.prompt([question]);
		return ans.password;
	}

	_serializeNetworks(networks) {
		return networks?.map((ap) => {
			return {
				ssid: ap.ssid,
				security: ap.security,
				signal_level: ap.rssi,
				channel: ap.channel.toString(),
				unsecure: ap.security === 'NO_SECURITY',
				mac: ''
			};
		});
	}

	_handleDeviceError(_error, { action } = { }) {
		const error = _error;
		if (_error.cause) {
			error.message = deviceControlError[error.name];
		}
		return new Error(`Unable to ${action}: ${error.message}`);
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
