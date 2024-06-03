const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');
const usbUtils = require('../cmd/usb-util');
const inquirer = require('inquirer');
const RESCAN_LABEL = '[rescan networks]';
const fs = require('fs-extra');
const { deviceControlError } = require('../lib/device-error-handler');
const ParticleApi = require('../cmd/api');
const settings = require('../../settings');
const createApiCache = require('../lib/api-cache');
const utilities = require('../lib/utilities');
const os = require('os');
const { WifiSecurityEnum } = require('particle-usb');
const chalk = require('chalk');
const { platformForId } = require('../lib/platform');

const JOIN_NETWORK_TIMEOUT = 30000;
const REQUEST_TIMEOUT = 10000;
const TIME_BETWEEN_RETRIES = 1000;
const NUM_TRIES = 3;
const WIFI_COMMANDS_SUPPORTED_DEVICE_GEN = 3;

const securityMapping = {
	'NO_SECURITY': 'NONE',
	'NONE': 'NONE',
	'WEP': 'WEP',
	'WPA_AES': 'WPA_PSK',
	'WPA_TKIP': 'WPA_PSK',
	'WPA_AES+TKIP': 'WPA_PSK',
	'WPA_PSK': 'WPA_PSK',
	'WPA2_AES': 'WPA2_PSK',
	'WPA2_TKIP': 'WPA2_PSK',
	'WPA2_AES+TKIP': 'WPA2_PSK',
	'WPA2_PSK': 'WPA2_PSK',
	'WPA_WPA2_PSK': 'WPA_WPA2_PSK',
	'WPA3_PSK': 'WPA3_PSK',
	'WPA2_WPA3_PSK': 'WPA2_WPA3_PSK',
};

const WifiSecurityConsolidatedForUserPrompt = ['NO_SECURITY', 'WEP', 'WPA_PSK', 'WPA2_PSK', 'WPA3_PSK'];

module.exports = class WiFiCommands extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		spinnerMixin(this);
		const { api } = this._particleApi();
		this.api = api;
		this.deviceId = null;
		this.device = null;
		this.ui = ui || this.ui;
	}

	async addNetwork(args) {
		this.file = args.file;
		await this._withDevice(async () => {
			const network = await this._getNetwork();
			await this.addWifi(network);
		});
	}

	async joinNetwork(args) {
		this.file = args.file;
		await this._withDevice(async () => {
			const network = await this._getNetwork();
			await this.joinWifi(network);
		});
	}

	async joinKnownNetwork(args) {
		this.file = args.file;
		await this._withDevice(async () => {
			await this.joinKnownWifi(args.ssid);
		});
	}

	async clearNetworks() {
		await this._withDevice(async () => {
			await this.clearWifi();
		});
	}

	async listNetworks() {
		await this._withDevice(async () => {
			await this.listWifi();
		});
	}

	async removeNetwork(args) {
		const { ssid } = args;
		if (!ssid) {
			throw new Error('Please provide a network name to remove using the --ssid flag.');
		}
		await this._withDevice(async () => {
			await this.removeWifi(ssid);
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
				const features = platformForId(this.device.platformId).features;
				this.deviceId = this.device._id;

				if (features.includes('wifi') === false) {
					throw new Error(`This device (${this.deviceId} / ${platformName}) does not support Wi-Fi.${os.EOL}`);
				}
				if (deviceGen < WIFI_COMMANDS_SUPPORTED_DEVICE_GEN) {
					throw new Error(`The 'particle wifi' commands are not supported on this device (${this.deviceId} / ${platformName}).${os.EOL}Use 'particle serial wifi' instead.${os.EOL}`);
				}
			}
			return await fn();
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
		const { network, security, password, hidden } = await fs.readJSON(this.file);
		if (!network) {
			const error = new Error('No network name found in the file');
			error.isUsageError = true;
			throw error;
		}
		return { ssid: network, security: this._convertToKnownSecType(security), password, hidden };
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
		let attempts = NUM_TRIES;
		let lastError = null;
		while (attempts > 0) {
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
				attempts--;
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
		return { ssid: network.ssid, security: this._convertToKnownSecType(network.security), password };
	}

	async _performWifiOperation(operationName, operationCallback) {
		this.newSpin(`${operationName}`).start();
		let lastError;

		if (!this.device) {
			this.stopSpin();
			throw new Error('No device found');
		}

		for (let attempt = 0; attempt < NUM_TRIES; attempt++) {
			try {
				// The device API can throw an error directly
				// or it can return an error in its result object in result.error
				const result = await operationCallback();
				this.stopSpin();
				return result;
			} catch (error) {
				// TODO: FIXME: use error.id === 'NOT_SUPPORTED'
				if (error.message === 'Not supported') {
					this.stopSpin();
					throw this._handleDeviceError(error, { action: this._getActionStringFromOp(operationName) });
				}
				if ((error.message === 'Invalid argument' || error.message === 'Invalid state') && operationName.toLowerCase().includes('join')) {
					this.stopSpin();
					throw this._handleDeviceError(error, { action: this._getActionStringFromOp(operationName) });
				}
				lastError = error;
			}
			await utilities.delay(TIME_BETWEEN_RETRIES);
		}
		this.stopSpin();
		throw this._handleDeviceError(lastError, { action: this._getActionStringFromOp(operationName) });
	}

	_getActionStringFromOp(operationName) {
		// This converts an operation name (e.g., 'Adding Wi-Fi network') to a verb form (e.g., 'Add Wi-Fi network')
		return operationName.replace(/^\w+/, match => match.toLowerCase().replace(/ing$/, ''));
	}

	async addWifi({ ssid, security, password, hidden }) {
		await this._performWifiOperation(`Adding Wi-Fi network '${ssid}'`, async () => {
			await this.device.setWifiCredentials({ ssid, security, password, hidden }, { timeout: REQUEST_TIMEOUT });
		});

		this.ui.stdout.write(`Wi-Fi network '${ssid}' added successfully.${os.EOL}`);
		this.ui.stdout.write(`To join this network, run ${chalk.yellow('particle wifi join --ssid <SSID>')}${os.EOL}`);
		this.ui.stdout.write(os.EOL);
	}

	async joinWifi({ ssid, security, password, hidden }) {
		let mode;
		await this._performWifiOperation(`Joining Wi-Fi network '${ssid}'`, async () => {
			mode = await this.device.getDeviceMode({ timeout: 10 * 1000 });
			await this.device.joinNewWifiNetwork({ ssid, security, password, hidden }, { timeout: JOIN_NETWORK_TIMEOUT });
		});

		// Device does not exit listening mode after joining a network.
		// Until the behavior is fixed, we will exit listening mode manually.
		if (mode === 'LISTENING') {
			this.ui.stdout.write(`Exiting listening mode...${os.EOL}`);
			try {
				await this.device.leaveListeningMode();
			} catch (error) {
				// Ignore error
				// It's not critical that the device does not exit listening mode
			}
		}

		this.ui.stdout.write(`Wi-Fi network '${ssid}' configured successfully. Attempting to join...${os.EOL}Use ${chalk.yellow('particle wifi current')} to check the current network.${os.EOL}`);
	}

	async joinKnownWifi(ssid) {
		let mode;
		await this._performWifiOperation(`Joining a known Wi-Fi network '${ssid}'`, async () => {
			mode = await this.device.getDeviceMode({ timeout: 10 * 1000 });
			await this.device.joinKnownWifiNetwork({ ssid }, { timeout: JOIN_NETWORK_TIMEOUT });
		});

		// Device does not exit listening mode after joining a network.
		// Until the behavior is fixed, we will exit listening mode manually.
		if (mode === 'LISTENING') {
			this.ui.stdout.write(`Exiting listening mode...${os.EOL}`);
			try {
				await this.device.leaveListeningMode();
			} catch (error) {
				// Ignore error
				// It's not critical that the device does not exit listening mode
			}
		}

		this.ui.stdout.write(`Wi-Fi network '${ssid}' configured successfully. Attemping to join...${os.EOL}Use ${chalk.yellow('particle wifi current')} to check the current network.${os.EOL}`);
	}

	async clearWifi() {
		await this._performWifiOperation('Clearing Wi-Fi networks', async () => {
			await this.device.clearWifiNetworks({ timeout: REQUEST_TIMEOUT });
		});

		this.ui.stdout.write(`Wi-Fi networks cleared successfully.${os.EOL}`);
	}

	async _getCurrentNetwork() {
		let currentNetwork;
		const ifaces = await this.device.getNetworkInterfaceList();
		const wifiIface = await this.device.getNetworkInterface({ index: ifaces.find(iface => iface.type === 'WIFI').index });
		if (wifiIface && wifiIface.flagsStrings.includes('LOWER_UP')) {
			try {
				currentNetwork = await this.device.getCurrentWifiNetwork({ timeout: REQUEST_TIMEOUT });
			} catch (error) {
				// Ignore error if the device does not support the getCurrentWifiNetwork command
			}
		}
		return currentNetwork;
	}

	async listWifi() {
		let list, currentNetwork;
		await this._performWifiOperation('Listing Wi-Fi networks', async () => {
			list = await this.device.listWifiNetworks({ timeout: REQUEST_TIMEOUT });
			currentNetwork = await this._getCurrentNetwork();
		});

		this.ui.stdout.write(`List of Wi-Fi networks on the device:${os.EOL}${os.EOL}`);
		const networks = list?.networks || [];

		if (networks.length) {
			const currentSsid = currentNetwork?.ssid;
			networks.forEach(network => {
				const networkInfo = `- ${network.ssid} (${WifiSecurityEnum[network.security]})`;
				if (currentSsid === network.ssid) {
					this.ui.stdout.write(`${networkInfo} - current network${os.EOL}`);
				} else {
					this.ui.stdout.write(`${networkInfo}${os.EOL}`);
				}
			});
		} else {
			this.ui.stdout.write('No Wi-Fi networks found.');
		}
		this.ui.stdout.write(os.EOL);
	}

	async removeWifi(ssid) {
		await this._performWifiOperation('Removing Wi-Fi networks', async () => {
			await this.device.removeWifiNetwork({ ssid }, { timeout: REQUEST_TIMEOUT });
		});

		this.ui.stdout.write(`Wi-Fi network ${ssid} removed from device's list successfully.${os.EOL}`);
		this.ui.stdout.write(`To disconnect from the network, run ${chalk.yellow('particle usb reset')}.${os.EOL}`);
		this.ui.stdout.write(os.EOL);
	}

	async getCurrentWifiNetwork() {
		const parsedResult = await this._performWifiOperation('Fetching current Wi-Fi network', async () => {
			const currentNetwork = await this._getCurrentNetwork();
			if (!currentNetwork) {
				throw new Error('No Wi-Fi network connected');
			}
			return currentNetwork;
		});

		this.ui.stdout.write(`Current Wi-Fi network:${os.EOL}${os.EOL}`);
		this.ui.stdout.write(`- SSID: ${parsedResult?.ssid}${os.EOL}` +
            (`  BSSID: ${parsedResult?.bssid}${os.EOL}`) +
            `  Channel: ${parsedResult?.channel}${os.EOL}` +
            `  RSSI: ${parsedResult?.rssi}${os.EOL}${os.EOL}`);
	}

	async _pickNetworkManually() {
		const hidden = await this._promptForHiddenNetwork();
		const ssid = await this._promptForSSID();
		const security = await this._promptForSecurityType();
		let password = null;
		if (security !== 'NO_SECURITY') {
			password = await this._promptForPassword();
		}
		return { ssid, security: this._convertToKnownSecType(security), password, hidden };
	}

	// For Gen 3 and above, ensure that the security string ends with `PSK`.
	// Device-OS processes only known security types and they all end with `PSK` of their kind.
	// Similar security types are consolidated and mapped to a unified type ending in `PSK`.
	// Example: WPA_AES, WPA_TKIP, WPA_AES+TKIP are all treated as WPA_PSK.
	// For the exact mapping, see https://github.com/particle-iot/device-os-protobuf/blob/main/control/wifi_new.proto
	_convertToKnownSecType(security) {
		try {
			return securityMapping[security];
		} catch (error) {
			throw new Error(`Unknown security type: ${security} - ${error.message}`);
		}
	}

	async _promptForHiddenNetwork() {
		const question = {
			type: 'confirm',
			name: 'hidden',
			message: 'Is this a hidden network?',
			default: false
		};
		const ans = await this.ui.prompt([question]);
		return ans.hidden;
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
		const securityChoices = WifiSecurityConsolidatedForUserPrompt;
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

	// TODO: Fix error handling
	// Figure out a way to differentiate between USB errors and device errors and handle them accordingly
	_handleDeviceError(_error, { action } = { }) {
		const error = _error;
		if (_error.cause) {
			error.message = deviceControlError[error.name];
		}

		let helperString = '';

		switch (error.message) {
			case 'Request timeout':
				if (action.toLowerCase().includes('join')) {
					helperString = 'Please check the network credentials.';
				}
				break;
			case 'Invalid state':
				if (action.toLowerCase().includes('fetch')) {
					helperString = 'Check that the device is connected to the network.';
				}
				if (action.toLowerCase().includes('join')) {
					helperString = `${os.EOL}1. Please check the network credentials.\
									${os.EOL}2. Please verify that the Access Point is in range.\
									${os.EOL}3. If you are using a hidden network, please add the hidden network credentials first using 'particle wifi add'.${os.EOL}`;
				}
				break;
			case 'Not found':
				helperString = 'If you are using a hidden network, please add the hidden network credentials first using \'particle wifi add\'.';
				break;
			case 'Not supported':
				helperString = `This feature is likely not supported on this firmware version.${os.EOL}Update to device-os 6.2.0 or use 'particle wifi join --help' to join a network.${os.EOL}Alternatively, check 'particle serial wifi'.${os.EOL}`;
				break;
			case 'Invalid argument':
				helperString = 'Please check the network credentials.';
				break;
			default:
				break;
		}
		return new Error(`Unable to ${action}: ${error.message}${os.EOL}${helperString}`);
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
