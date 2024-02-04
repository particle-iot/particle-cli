const { getOneUsbDevice } = require('../cmd/usb-util');
const { prompt } = require('inquirer');
const os = require('os');
const inquirer = require('inquirer');
const RESCAN_LABEL = '[rescan networks]';
const fs = require('fs-extra');

module.exports = class WiFiControlRequest {
	constructor(deviceId, { ui, newSpin, stopSpin, file }) {
		this.deviceId = deviceId;
		this.device = null;
		this.ui = ui;
		this.newSpin = newSpin;
		this.stopSpin = stopSpin;
		this.file = file;
	}

	async configureWifi() {
		// prompt for scan networks
		let network;
		if (this.file) {
			network = await this.getNetworkToConnectFromJson();
		} else {
			network = await this.getNetworkToConnect();
		}

		if (network) {
			const success = await this.joinWifi(network);
			if (success) {
				this.ui.stdout.write('Successfully connected to Wi-Fi');
				this.ui.stdout.write(`${os.EOL}`);
				this.ui.stdout.write(`Done! Your device should now restart.${os.EOL}`);
				process.exit(0);
			} else {
				this.ui.stderr.write('Failed to connect to Wi-Fi');
				this.ui.stderr.write(`${os.EOL}`);
				process.exit(1);
			}
		} else {
			this.ui.stdout.write(`${os.EOL}`);
			this.ui.stdout.write('No network selected');
			this.ui.stdout.write(`${os.EOL}`);
			process.exit(1);
		}
	}

	async getNetworkToConnectFromJson() {
		try {
			const { network, password } = await fs.readJSON(this.file);
			if (!network) {
				this.ui.stderr.write('No SSID found in the file');
				return null;
			}
			return { ssid: network, password };
		} catch (error) {
			throw new Error('Ups! We could not read the file. Please try again.', error.message);
		}

	}

	async getNetworkToConnect({ prompt = true } = { }) {
		try {
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
				}
			}
			return await this.pickNetworkManually();
		} catch (error) {
			throw new Error('Ups! something went wrong. Please try again.', error.message);
		}
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
		this.newSpin('Scanning for Wi-Fi networks').start();
		let networks = [];
		networks = await this._deviceScanNetworks();
		this.stopSpin();
		if (!networks.length) {
			const answers = await prompt([{
				type: 'confirm',
				name: 'rescan',
				message: 'Uh oh, no networks found. Try again?',
				default: true
			}]);
			if (answers.rescan){
				networks = this.scanNetworks();
			}
		}
		return this._filterNetworks(networks);
	}

	_filterNetworks(networkList) {
		return networkList.filter((ap) => {
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
	}

	async _deviceScanNetworks() {
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await getOneUsbDevice({ ui: this.ui });
			}
			const networks = await this.device.scanWifiNetworks();
			return this._serializeNetworks(networks) || [];
		} catch (error) {
			return []; // ignore error if no networks found
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
		}
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
		this.newSpin(`Joining Wi-Fi network ${ssid}`).start();
		try {
			if (!this.device || this.device.isOpen === false) {
				this.device = await getOneUsbDevice({ idOrName: this.deviceId });
			}
			const { pass }  = await this.device.joinNewWifiNetwork({ ssid, password }, { timeout: 30000 });
			if (pass) {
				await this.device.reset();
			}
			return pass;
		} catch (error) {
			this.ui.stderr.write(`Unable to join Wi-Fi network: ${error.message}`);
			return false;
		} finally {
			if (this.device && this.device.isOpen) {
				await this.device.close();
			}
			this.stopSpin();
		}
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
};
