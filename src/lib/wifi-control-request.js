const usbUtils = require('../cmd/usb-util');
const inquirer = require('inquirer');
const RESCAN_LABEL = '[rescan networks]';
const fs = require('fs-extra');
const { deviceControlError } = require('./device-error-handler');
const JOIN_NETWORK_TIMEOUT = 30000;
const TIME_BETWEEN_RETRIES = 1000;
const RETRY_COUNT = 1;
const ParticleApi = require('../cmd/api');
const settings = require('../../settings');
const createApiCache = require('./api-cache');
const utilities = require('./utilities');
const os = require('os');
const semver = require('semver');
const { WifiSecurityEnum } = require('particle-usb');

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

	async addNetwork() {
		let network;
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			}

			const fwVer = this.device.firmwareVersion;
			if (semver.lt(fwVer, '6.2.0')) {
				throw new Error(`The 'add' command is not supported on this firmware version.${os.EOL}Use 'particle wifi join --help' to join a network.${os.EOL}`);
			}
			await this.ensureVersionCompat({
				version: this.device.firmwareVersion,
				command: 'add'
			});

			if (this.file) {
				network = await this.getNetworkToConnectFromJson();
			} else {
				network = await this.getNetworkToConnect(this.device);
			}
			await this.addWifi(network);
		} catch (error) {
			throw error;
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
	}

	async joinNetwork() {
		let network;
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			}

			if (this.file) {
				network = await this.getNetworkToConnectFromJson();
			} else {
				network = await this.getNetworkToConnect(this.device);
			}
			await this.joinWifi(network);
		} catch (error) {
			throw error;
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
	}

	async joinKnownNetwork(ssid) {
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			}
			await this.joinKnownWifi(ssid);
		} catch (error) {
			throw error;
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
	}

	async listNetworks() {
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			}
			await this.listWifi();
		} catch (error) {
			throw error;
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
	}

	async removeNetwork(ssid) {
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			}
			await this.removeWifi(ssid);
			await this.listNetworks();
		} catch (error) {
			throw error;
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
	}

	async clearNetworks() {
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
			}
			await this.clearWifi();
		} catch (error) {
			throw error;
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
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
				if (!this.device) {
					throw new Error('No device found');
				}

				const networks = await this.device.scanWifiNetworks();
				this.stopSpin();
				return this._serializeNetworks(networks) || [];
			} catch (error) {
				lastError = error;
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
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

	async addWifi({ ssid, password }) {
		let retries = RETRY_COUNT;
		const spin = this.newSpin(`Joining Wi-Fi network '${ssid}'`).start();
		let lastError;
		while (retries > 0) {
			try {
				if (!this.device) {
					throw new Error('No device found');
				}
				const { pass, error }  = await this.device.setWifiCredentials({ ssid, password }, { timeout: JOIN_NETWORK_TIMEOUT });
				if (pass) {
					this.stopSpin();
					this.ui.stdout.write('Wi-Fi network added successfully.');
					this.ui.stdout.write(os.EOL);
					return;
				}
				retries = 0;
				lastError = new Error(error);
			} catch (error) {
				spin.setSpinnerTitle(`Joining Wi-Fi network '${ssid}' is taking longer than expected.`);
				lastError = error;
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
			}
		}
		this.stopSpin();
		throw this._handleDeviceError(lastError, { action: 'add Wi-Fi network' });
	}

	async joinWifi({ ssid, password }) {
		let retries = RETRY_COUNT;
		const spin = this.newSpin(`Joining Wi-Fi network '${ssid}'`).start();
		let lastError;
		while (retries > 0) {
			try {
				if (!this.device) {
					throw new Error('No device found');
				}
				const { pass, error }  = await this.device.joinNewWifiNetwork({ ssid, password }, { timeout: JOIN_NETWORK_TIMEOUT });
				if (pass) {
					this.stopSpin();
					this.ui.stdout.write('Wi-Fi network configured successfully, your device should now restart.');
					this.ui.stdout.write(os.EOL);
					await this.device.reset();
					return;
				}
				retries = 0;
				lastError = new Error(error);
			} catch (error) {
				spin.setSpinnerTitle(`Joining Wi-Fi network '${ssid}' is taking longer than expected.`);
				lastError = error;
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
			}
		}
		this.stopSpin();
		throw this._handleDeviceError(lastError, { action: 'join Wi-Fi network' });
	}

	async joinKnownWifi({ ssid }) {
		let retries = RETRY_COUNT;
		const spin = this.newSpin(`Joining Wi-Fi network '${ssid}'`).start();
		let lastError;
		while (retries > 0) {
			try {
				if (!this.device) {
					throw new Error('No device found');
				}
				const { pass, error }  = await this.device.joinKnownWifiNetwork({ ssid }, { timeout: JOIN_NETWORK_TIMEOUT });
				if (pass) {
					this.stopSpin();
					this.ui.stdout.write('Wi-Fi network configured successfully, your device should now restart.');
					this.ui.stdout.write(os.EOL);
					await this.device.reset();
					return;
				}
				retries = 0;
				lastError = new Error(error);
			} catch (error) {
				lastError = error;
				spin.setSpinnerTitle(`Joining Wi-Fi network '${ssid}' is taking longer than expected.`);
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
			}
		}
		this.stopSpin();
		// TODO: Add a more helpful error msg. "Not found" could be either not found in the device or the network 
		throw this._handleDeviceError(lastError, { action: 'join Wi-Fi network' });
	}

	async clearWifi() {
		let retries = RETRY_COUNT;
		const spin = this.newSpin('Clearing Wi-Fi networks').start();
		let lastError;
		while (retries > 0) {
			try {
				if (!this.device) {
					throw new Error('No device found');
				}
				const { pass, error }  = await this.device.clearWifiNetworks({ timeout : JOIN_NETWORK_TIMEOUT });
				if (pass) {
					this.stopSpin();
					this.ui.stdout.write('Wi-Fi networks cleared successfully.');
					this.ui.stdout.write(os.EOL);
					return;
				}
				retries = 0;
				lastError = new Error(error);
			} catch (error) {
				lastError = error;
				spin.setSpinnerTitle('Clearing Wi-Fi networks is taking longer than expected.');
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
			}
		}
		this.stopSpin();
		throw this._handleDeviceError(lastError, { action: 'clear Wi-Fi networks' });
	}

	async listWifi() {
		let retries = RETRY_COUNT;
		const spin = this.newSpin('Listing Wi-Fi networks').start();
		let lastError;
		while (retries > 0) {
			try {
				if (!this.device) {
					throw new Error('No device found');
				}
				const { pass, replyObject }  = await this.device.listWifiNetworks({ timeout : JOIN_NETWORK_TIMEOUT });
				if (pass) {
					this.stopSpin();
					this.ui.stdout.write(`List of Wi-Fi networks:${os.EOL}${os.EOL}`);
					const networks = replyObject.networks;
					if (networks.length) {
						networks.forEach((network) => {
							this.ui.stdout.write(`- SSID: ${network.ssid}\n  Security: ${WifiSecurityEnum[network.security]}\n  Credentials Type: ${network.credentialsType}`);
							this.ui.stdout.write(os.EOL);
							this.ui.stdout.write(os.EOL);
						});
					} else {
						this.ui.stdout.write('\tNo Wi-Fi networks found.');
						this.ui.stdout.write(os.EOL);
					}
					this.ui.stdout.write(os.EOL);
					return;
				}
				retries = 0;
				lastError = new Error(error);
			} catch (error) {
				lastError = error;
				spin.setSpinnerTitle('Listing Wi-Fi networks is taking longer than expected.');
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
			}
		}
		this.stopSpin();
		throw this._handleDeviceError(lastError, { action: 'list Wi-Fi networks' });
	}

	async removeWifi(ssid) {
		let retries = RETRY_COUNT;
		const spin = this.newSpin('Removing Wi-Fi networks').start();
		let lastError;
		while (retries > 0) {
			try {
				if (!this.device) {
					throw new Error('No device found');
				}
				const { pass, error }  = await this.device.removeWifiNetwork( { ssid }, { timeout : JOIN_NETWORK_TIMEOUT });
				if (pass) {
					this.stopSpin();
					this.ui.stdout.write(`Wi-Fi network ${ssid} removed successfully.${os.EOL}`);
					this.ui.stdout.write(`Your device will stay connected to this network until reset or connected to other network. Run 'particle wifi --help' to learn more.${os.EOL}`);
					// XXX: What about disconnecting from the network?
					this.ui.stdout.write(os.EOL);
					return;
				}
				retries = 0;
				lastError = new Error(error);
			} catch (error) {
				lastError = error;
				spin.setSpinnerTitle('Removing Wi-Fi networks is taking longer than expected.');
				await utilities.delay(TIME_BETWEEN_RETRIES);
				retries--;
			}
		}
		this.stopSpin();
		throw this._handleDeviceError(lastError, { action: 'remove Wi-Fi networks' });
	
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
