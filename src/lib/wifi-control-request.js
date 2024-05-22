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
const { WifiSecurityEnum } = require('particle-usb');
const chalk = require('chalk');
const { platformForId } = require('../lib/platform');

// TODO: Fix retries - Only retry if it makes sense

// TODO: Tell people if you want to use a hidden nwetwork, use particle wifi add and use the file optionparticle wifi join

// Tests!!!!!!!

const WIFI_COMMANDS_SUPPORTED_DEVICE_GEN = 3;

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
		await this._withDevice(async () => {
			try {
				const network = await this._getNetwork();
				await this.addWifi(network);
			} catch (error) {
				if (error.message.endsWith('Not supported')) {
					if (this.device.generation < 3) {
						throw new Error(`The 'add' command is not supported on this device (${this.device.deviceId}). Use 'particle serial wifi'.${os.EOL}`);
					}
					throw new Error(`The 'add' command is not supported on this firmware version.${os.EOL}Use 'particle wifi join --help' to join a network.${os.EOL}Alternatively, check 'particle serial wifi' for more options.${os.EOL}`);
				}
				throw error;
			}
		});
	}

	async joinNetwork() {
		await this._withDevice(async () => {
			try {
				const network = await this._getNetwork();
				await this.joinWifi(network);
			} catch (error) {
				if (error.message.endsWith('Not found')) {
					throw new Error(`Network not found.${os.EOL}If you are using a hidden network, please add the hidden network credentials first using 'particle wifi add'.${os.EOL}`);
				}
				throw error;
			}
		});
	}

	async joinKnownNetwork(ssid) {
		await this._withDevice(async () => {
			await this.joinKnownWifi(ssid);
		});
	}

	async listNetworks() {
		await this._withDevice(async () => {
			await this.listWifi();
		});
	}

	async removeNetwork(ssid) {
		await this._withDevice(async () => {
			await this.removeWifi(ssid);
			await this.listNetworks();
		});
	}

	async clearNetworks() {
		await this._withDevice(async () => {
			await this.clearWifi();
		});
	}

	async getCurrentNetwork() {
		await this._withDevice(async () => {
			await this.getCurrentWifiNetwork();
		});
	}

	async _withDevice(fn) {
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await usbUtils.getOneUsbDevice({ api: this.api, idOrName: this.deviceId, ui: this.ui });
				const deviceGen = platformForId(this.device.platformId).generation;
				const platformName = platformForId(this.device.platformId).name;
				this.deviceId = this.device._id;
				if (deviceGen < WIFI_COMMANDS_SUPPORTED_DEVICE_GEN) {
					throw new Error(`The 'particle wifi' commands are not supported on this device (${this.deviceId} / ${platformName}).${os.EOL} Use 'particle serial wifi'.${os.EOL}`);
				}
			}
			return await fn();
		} catch (error) {
			throw error;
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
	}

	async _getNetwork() {
		let network;
		if (this.file) {
			network = await this._getNetworkToConnectFromJson();
		} else {
			network = await this._getNetworkToConnect();
		}
		return network;
	}

	async _getNetworkToConnectFromJson() {
		const { network, security, password } = await fs.readJSON(this.file);
		if (!network) {
			const error = new Error('No network name found in the file');
			error.isUsageError = true;
			throw error;
		}
		return { ssid: network, security: WifiSecurityEnum[this._convertToKnownSecType(security)], password };
	}

	async _getNetworkToConnect({ prompt = true } = { }) {
		let scan = true;
		if (prompt) {
			scan = await this._promptForScanNetworks();
		}
		if (scan) {
			const networks = await this._scanNetworks();
			if (networks.length) {
				const network = await this._promptToSelectNetwork(networks);
				if (network?.rescan){
					return await this._getNetworkToConnect({ prompt: false });
				} else {
					return network;
				}
			} else {
				throw new Error('No Wi-Fi networks found');
			}
		}
		return this._pickNetworkManually();
	}

	async _promptForScanNetworks() {
		const question = {
			type: 'confirm',
			name: 'scan',
			message: 'Would you like to scan for Wi-Fi networks?'
		};
		const ans = await this.ui.prompt([question]);
		return ans.scan;
	}

	async _scanNetworks() {
		const networks = await this._deviceScanNetworks();
		if (!networks.length) {
			const answers = await this.ui.prompt([{
				type: 'confirm',
				name: 'rescan',
				message: 'No networks found. Try again?',
				default: true
			}]);
			if (answers.rescan){
				return this._scanNetworks();
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

	async _promptToSelectNetwork(networks) {
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
		return { ssid: network.ssid, security: WifiSecurityEnum[this._convertToKnownSecType(network.security)], password };
	}

	async _performWifiOperation(operationName, operationCallback) {
		const spin = this.newSpin(`${operationName}`).start();
		let lastError;

		const tryOperation = async () => {
			if (!this.device) {
				throw new Error('No device found');
			}

			return await operationCallback();
		};

		for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
			try {
				const result = await tryOperation();
				if (result !== false) {
					this.stopSpin();
					return result;
				}
			} catch (error) {
				if (error.message === 'NOT_SUPPORTED') {
					this.stopSpin();
					throw error;
				}
				lastError = error;
			}

			spin.setSpinnerTitle(`${operationName} is taking longer than expected.`);
			await utilities.delay(TIME_BETWEEN_RETRIES);
		}

		this.stopSpin();
		console.log('operationName', operationName);
		throw this._handleDeviceError(lastError, { action: operationName.toLowerCase() });
	}


	async addWifi({ ssid, security, password }) {
		// Error can be coming from the particle-usb device API call
		// or the device API call might return the error in the result object without throwing an error
		let result;
		await this._performWifiOperation(`Adding Wi-Fi network '${ssid}'`, async () => {
			result = await this.device.setWifiCredentials({ ssid, security, password }, { timeout: JOIN_NETWORK_TIMEOUT });
		});

		const { pass, error } = result;

		if (pass) {
			this.ui.stdout.write(`Wi-Fi network '${ssid}' added successfully.${os.EOL}`);
			this.ui.stdout.write(`To join this network, run ${chalk.yellow('particle wifi join --ssid <SSID>')}${os.EOL}`);
			this.ui.stdout.write(os.EOL);
			return true;
		}
		throw this._handleDeviceError(error, { action: 'add Wi-Fi network' });
	}

	async joinWifi({ ssid, password }) {
		let result;
		await this._performWifiOperation(`Joining Wi-Fi network '${ssid}'`, async () => {
			result = await this.device.joinNewWifiNetwork({ ssid, password }, { timeout: JOIN_NETWORK_TIMEOUT });
		});
		const { pass, error } = result;
		if (pass) {
			this.ui.stdout.write(`Wi-Fi network '${ssid}' configured and joined successfully.${os.EOL}`);
			return true;
		}
		throw this._handleDeviceError(error, { action: 'join Wi-Fi network' });
	}

	async joinKnownWifi({ ssid }) {
		let result;
		await this._performWifiOperation(`Joining Wi-Fi network '${ssid}'`, async () => {
			result = await this.device.joinKnownWifiNetwork({ ssid }, { timeout: JOIN_NETWORK_TIMEOUT });
		});

		const { pass, error } = result;
		if (pass) {
			this.ui.stdout.write(`Wi-Fi network '${ssid}' joined successfully.${os.EOL}`);
			await this.device.reset();
			return true;
		}
		throw this._handleDeviceError(error, { action: 'join known Wi-Fi network' });
	}

	async clearWifi() {
		let result;
		await this._performWifiOperation('Clearing Wi-Fi networks', async () => {
			result = await this.device.clearWifiNetworks({ timeout: JOIN_NETWORK_TIMEOUT });
		});

		const { pass, error } = result;
		if (pass) {
			this.ui.stdout.write(`Wi-Fi networks cleared successfully.${os.EOL}`);
			return true;
		}
		throw this._handleDeviceError(error, { action: 'clear Wi-Fi networks' });
	}

	async listWifi() {
		let result, resultCurrNw;
		await this._performWifiOperation('Listing Wi-Fi networks', async () => {
			result = await this.device.listWifiNetworks({ timeout: JOIN_NETWORK_TIMEOUT });
		});
		try {
			resultCurrNw = await this.device.getCurrentWifiNetwork({ timeout: JOIN_NETWORK_TIMEOUT });
		} catch (error) {
			// Ignore error as it's not mandatory to get current network
			resultCurrNw = { pass: false };
		}

		const { pass, error, replyObject } = result;
		const { pass: passCurrNw, replyObject: replyObjectCurrNw } = resultCurrNw;

		if (pass) {
			this.ui.stdout.write(`List of Wi-Fi networks:${os.EOL}${os.EOL}`);
			const networks = replyObject.networks;
			if (networks.length) {
				networks.forEach((network) => {
					const passwordProtected = network.credentialsType === 0 ? 'Open' : null;
					const currentSsid = passCurrNw && replyObjectCurrNw ? replyObjectCurrNw.ssid : null;
					const networkInfo = `- ${network.ssid} (${WifiSecurityEnum[network.security]})${passwordProtected ? `, ${passwordProtected}` : ''}`;
					if (currentSsid === network.ssid) {
						this.ui.stdout.write(`${networkInfo} - current network${os.EOL}`);
					} else {
						this.ui.stdout.write(`${networkInfo}${os.EOL}`);
					}
					this.ui.stdout.write(os.EOL);
				});
			}
			return true;
		} else if (error) {
			throw this._handleDeviceError(error, { action: 'list Wi-Fi networks' });
		} else {
			this.ui.stdout.write('\tNo Wi-Fi networks found.');
			this.ui.stdout.write(os.EOL);
			return true;
		}	
	}

	async removeWifi(ssid) {
		let result;

		await this._performWifiOperation('Removing Wi-Fi networks', async () => {
			result = await this.device.removeWifiNetwork({ ssid }, { timeout: JOIN_NETWORK_TIMEOUT });
		});

		const { pass, error } = result;
		if (pass) {
			this.ui.stdout.write(`Wi-Fi network ${ssid} removed successfully.${os.EOL}`);
			this.ui.stdout.write(`Your device will stay connected to this network until reset or connected to another network. Run 'particle wifi --help' to learn more.${os.EOL}`);
			this.ui.stdout.write(os.EOL);
			return true;
		}
		throw this._handleDeviceError(error, { action: 'remove Wi-Fi network' });
	}

	async getCurrentWifiNetwork() {
		let result;

		await this._performWifiOperation('Getting current Wi-Fi network', async () => {
			result = await this.device.getCurrentWifiNetwork({ timeout: JOIN_NETWORK_TIMEOUT });
		});

		const { pass, error, replyObject } = result;

		if (pass) {
			this.ui.stdout.write(`Current Wi-Fi network:${os.EOL}${os.EOL}`);
			if (replyObject.ssid) {
				let bssid = null;
				if (replyObject.bssid) {
					// Convert buffer to string separated by colons
					bssid = Array.from(replyObject.bssid).map((byte) => byte.toString(16).padStart(2, '0')).join(':');
				}
				this.ui.stdout.write(`- SSID: ${replyObject.ssid}${os.EOL}` +
					(bssid ? `  BSSID: ${bssid}${os.EOL}` : '') +
					`  Channel: ${replyObject.channel}${os.EOL}` +
					`  RSSI: ${replyObject.rssi}${os.EOL}${os.EOL}`);
			}
			return true;
		}
		throw this._handleDeviceError(error, { action: 'get current Wi-Fi network' });
	}

	async _pickNetworkManually() {
		const ssid = await this._promptForSSID();
		const security = await this._promptForSecurityType();
		const password = await this._promptForPassword();

		return { ssid, security: WifiSecurityEnum[this._convertToKnownSecType(security)], password };
	}

	_convertToKnownSecType(security) {
		// Upon observation of device-os mappings,
		// the following are the known security types
		// FIXME: This mapping may change as per device-os changes
		if (security.startsWith('WEP')) {
			return 'WEP';
		} else if (security.startsWith('WPA_WPA2')) {
			return 'WPA_WPA2_PSK';
		} else if (security.startsWith('WPA2_WPA3')) {
			return 'WPA2_WPA3_PSK';
		} else if (security.startsWith('WPA3')) {
			return 'WPA3_PSK';
		} else if (security.startsWith('WPA2')) {
			return 'WPA2_PSK';
		} else if (security.startsWith('WPA')) {
			return 'WPA_PSK';
		} else {
			return 'NONE';
		}
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

	async _promptForSecurityType() {
		// TODO: Expand the list of security types to include more relevant options
		// (e.g., WPA_AES for WPA_PSK) to assist users who may not know the specific associations
		const securityChoices = Object.keys(WifiSecurityEnum);
		const question = [
			{
				type: 'list',
				name: 'security',
				message: 'Select the security type for your Wi-Fi network:',
				choices: securityChoices
			},
		];
		const ans = await this.ui.prompt(question);
		return ans.security;
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
		if (typeof _error  === 'string' && _error.startsWith('Request timed out')) {
			return new Error(`Unable to ${action}: Request timed out`);
		}
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
