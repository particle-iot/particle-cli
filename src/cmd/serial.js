const os = require('os');
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const chalk = require('chalk');
const VError = require('verror');
const inquirer = require('inquirer');
const prompt = require('inquirer').prompt;
const wifiScan = require('node-wifiscanner2').scan;
const { SerialPort } = require('serialport');
const log = require('../lib/log');
const specs = require('../lib/device-specs');
const CLICommandBase = require('./base');
const settings = require('../../settings');
const SerialBatchParser = require('../lib/serial-batch-parser');
const SerialTrigger = require('../lib/serial-trigger');
const spinnerMixin = require('../lib/spinner-mixin');
const { ensureError } = require('../lib/utilities');
const FlashCommand = require('./flash');
const usbUtils = require('./usb-util');
const { platformForId } = require('../lib/platform');
const { FirmwareModuleDisplayNames } = require('particle-usb');
const semver = require('semver');

const IDENTIFY_COMMAND_TIMEOUT = 20000;

// TODO: DRY this up somehow
// The categories of output will be handled via the log class, and similar for protip.
const cmd = path.basename(process.argv[1]);
const arrow = chalk.green('>');
const timeoutError = 'Serial timed out';

const availability = (asset, availableAssets) => availableAssets.some(
	availableAsset => availableAsset.hash === asset.hash && availableAsset.name === asset.name
);

const SERIAL_PORT_DEFAULTS = {
	baudRate: 9600,
	autoOpen: false
};

module.exports = class SerialCommand extends CLICommandBase {
	constructor(){
		super();
		spinnerMixin(this);
	}

	findDevices(){
		return SerialPort.list()
			.then(ports => {
				const devices = [];

				ports.forEach((port) => {
					// manufacturer value
					// Mac - Spark devices
					// Devices on old driver - Spark Core, Photon
					// Devices on new driver - Particle IO (https://github.com/spark/firmware/pull/447)
					// Windows only contains the pnpId field

					let device;
					const serialDeviceSpec = _.find(specs, (deviceSpec) => {
						if (!deviceSpec.serial){
							return false;
						}
						const vid = deviceSpec.serial.vid;
						const pid = deviceSpec.serial.pid;

						const usbMatches = (port.vendorId === vid.toLowerCase() && port.productId === pid.toLowerCase());
						const pnpMatches = !!(port.pnpId && (port.pnpId.indexOf('VID_' + vid.toUpperCase()) >= 0) && (port.pnpId.indexOf('PID_' + pid.toUpperCase()) >= 0));

						return !!(usbMatches || pnpMatches);

					});

					if (serialDeviceSpec){
						device = {
							port: port.path,
							type: serialDeviceSpec.productName,
							deviceId: serialDeviceSpec.serial.deviceId && serialDeviceSpec.serial.deviceId(port.serialNumber || port.pnpId),
							specs: serialDeviceSpec
						};
					}

					// Populate the Device ID based on the ports serial number:
					if (device && port.serialNumber && typeof device.deviceId == 'undefined') {
						device.deviceId = port.serialNumber;
					}

					const matchesManufacturer = port.manufacturer && (port.manufacturer.indexOf('Particle') >= 0 || port.manufacturer.indexOf('Spark') >= 0 || port.manufacturer.indexOf('Photon') >= 0);

					if (!device && matchesManufacturer){
						device = { port: port.path, type: 'Core' };
					}

					if (device){
						devices.push(device);
					}
				});

				//if I didn't find anything, grab any 'ttyACM's
				if (devices.length === 0){
					ports.forEach((port) => {
						//if it doesn't have a manufacturer or pnpId set, but it's a ttyACM port, then lets grab it.
						if (port.path.indexOf('/dev/ttyACM') === 0){
							devices.push({ port: port.path, type: '' });
						} else if (port.path.indexOf('/dev/cuaU') === 0){
							devices.push({ port: port.path, type: '' });
						}
					});
				}

				return devices;
			})
			.catch(err => {
				throw new VError(ensureError(err), 'Error listing serial ports');
			});
	}

	listDevices(){
		return this.findDevices()
			.then(devices => {
				if (devices.length === 0){
					this.ui.stdout.write(`${chalk.bold.white('No devices available via serial')}`);
					return;
				}

				this.ui.stdout.write(`Found ${chalk.cyan(devices.length)} ${devices.length > 1 ? 'devices' : 'device'} connected via serial:${os.EOL}`);
				devices.forEach((device) => this.ui.stdout.write(`${device.port} - ${device.type} - ${device.deviceId}${os.EOL}`));
			});
	}

	monitorPort({ port, follow }){
		let cleaningUp = false;
		let selectedDevice;
		let serialPort;

		const displayError = (err) => {
			if (err){
				console.error('Serial err: ' + err);
				console.error('Serial problems, please reconnect the device.');
			}
		};

		// Called when port closes
		const handleClose = () => {
			this.ui.stdout.write(`${os.EOL}`);
			if (follow && !cleaningUp){
				this.ui.stdout.write(`${chalk.bold.white('Serial connection closed.  Attempting to reconnect...')}${os.EOL}`);
				return reconnect();
			}
			this.ui.stdout.write(`${chalk.bold.white('Serial connection closed.')}${os.EOL}`);
		};

		// Handle interrupts and close the port gracefully
		const handleInterrupt = () => {
			if (!cleaningUp){
				cleaningUp = true;
				if (serialPort && serialPort.isOpen){
					serialPort.close();
				}
				process.exit(0);
			}
		};

		// Called only when the port opens successfully
		const handleOpen = () => {
			this.ui.stdout.write(`${chalk.bold.white('Serial monitor opened successfully:')}${os.EOL}`);
		};

		// If device is not found but we are still '--follow'ing to find a device,
		// handlePortFn schedules a delayed retry using setTimeout.
		const handlePortFn = (device) => {
			if (!device) {
				if (follow) {
					setTimeout(() => {
						if (cleaningUp){
							return;
						} else {
							this.whatSerialPortDidYouMean(port, true)
								.catch(() => null)
								.then(handlePortFn);
						}
					}, settings.serial_follow_delay);
					return;
				} else {
					throw new VError('No serial port identified');
				}
			}

			this.ui.stdout.write(`Opening serial monitor for com port: " ${device.port} "${os.EOL}`);
			selectedDevice = device;
			openPort();
		};

		function openPort(){
			serialPort = new SerialPort({ path: selectedDevice.port, ...SERIAL_PORT_DEFAULTS });
			serialPort.on('close', handleClose);
			serialPort.on('readable', () => {
				process.stdout.write(serialPort.read().toString());
			});
			serialPort.on('error', displayError);
			serialPort.open((err) => {
				if (err && follow){
					reconnect(selectedDevice);
				} else if (err){
					displayError(err);
				} else {
					handleOpen();
				}
			});
		}

		function reconnect(){
			setTimeout(() => {
				openPort(selectedDevice);
			}, settings.serial_follow_delay);
		}

		process.on('SIGINT', handleInterrupt);
		process.on('SIGQUIT', handleInterrupt);
		process.on('SIGBREAK', handleInterrupt);
		process.on('SIGTERM', handleInterrupt);
		process.on('exit', () => handleInterrupt());

		if (follow){
			this.ui.stdout.write('Polling for available serial device...');
		}

		return this.whatSerialPortDidYouMean(port, true).then(handlePortFn);
	}

	/**
	 * Device identify gives the following
	 *     - Device ID
	 *     - (Cellular devices) Cell radio IMEI
	 *           - Obtained via control req for dvos > 5.6.0
	 *           - Obtained via serial otherwise
	 *     - (Cellular devices) Cell radio ICCID
	 *     - System firmware version
	 * This command is committed to print the values that are obtained from the device
	 * ignoring the ones that are not obtained
	 * @param {Number|String} comPort
	 */
	async identifyDevice({ port }) {
		let deviceFromSerialPort, device;

		let deviceId = '';
		let fwVer = '';
		let cellularImei = '';
		let cellularIccid = '';

		// Obtain device
		try {
			deviceFromSerialPort = await this.whatSerialPortDidYouMean(port, true);
			deviceId = deviceFromSerialPort.deviceId;
			device = await usbUtils.getOneUsbDevice({ idOrName: deviceId });
		} catch (err) {
			throw new VError(ensureError(err), 'Could not identify device');
		}

		// Obtain system firmware version
		fwVer = device.firmwareVersion;
		

		// If the device is a cellular device, obtain imei and iccid

		const features = platformForId(device.platformId).features;
		if (features.includes('cellular')) {
			// since from 6.x onwards we can't use serial to get imei, we use control request
			if (semver.gte(fwVer, '6.0.0')) {
				try {
					const cellularInfo = await device.getCellularInfo({ timeout: 2000 });
					if (!cellularInfo) {
						throw new VError('No data returned from control request for device info');
					}
					cellularImei = cellularInfo.imei;
					cellularIccid = cellularInfo.iccid;
				} catch (err) {
					// ignore and move on to get other fields
					throw new VError(ensureError(err), 'Could not get device info');
				}
			} else {
				try {
					const cellularInfo = await this.getDeviceInfoFromSerial(deviceFromSerialPort);
					if (!cellularInfo) {
						throw new VError('No data returned from serial port for device info');
					}
					cellularImei = cellularInfo.imei;
					cellularIccid = cellularInfo.iccid;
				} catch (err) {
					// ignore and move on to get other fields
					throw new VError(ensureError(err), 'Could not get device info, ensure the device is in listening mode');
				}
			}
		}

		// Print whatever was obtained from the device
		this._printIdentifyInfo({
			deviceId,
			fwVer,
			cellularImei,
			cellularIccid
		});

		// Clean up
		if (device && device.isOpen) {
			await device.close();
		}
	}

	_printIdentifyInfo({ deviceId, fwVer, cellularImei, cellularIccid }) {
		this.ui.stdout.write(`Your device id is ${chalk.bold.cyan(deviceId)}${os.EOL}`);
		if (cellularImei) {
			this.ui.stdout.write(`Your IMEI is ${chalk.bold.cyan(cellularImei)}${os.EOL}`);
		}
		if (cellularIccid) {
			this.ui.stdout.write(`Your ICCID is ${chalk.bold.cyan(cellularIccid)}${os.EOL}`);
		}
		if (fwVer) {
			this.ui.stdout.write(`Your system firmware version is ${chalk.bold.cyan(fwVer)}${os.EOL}`);
		}
	}

	/**
	 * Obtains mac address for wifi and ethernet devices
	 * @param {string} port
	 */
	async deviceMac({ port }) {
		let device;
		let macAddress, currIfaceName;
		try {
			const deviceFromSerialPort = await this.whatSerialPortDidYouMean(port, true);
			const deviceId = deviceFromSerialPort.deviceId;
			device = await usbUtils.getOneUsbDevice({ idOrName: deviceId });
		} catch (err) {
			throw new VError(ensureError(err), 'Could not identify device');
		}

		try {
			const networkIfaceListreply = await device.getNetworkInterfaceList({ timeout: 2000 });

			// We expect either one Wifi interface or one Ethernet interface
			// Find it and return the hw address value from that interface
			for (const iface of networkIfaceListreply) {
				const index = iface.index;
				const type = iface.type;

				if (type === 'WIFI' || type === 'ETHERNET') {
					const networkIfaceReply = await device.getNetworkInterface({ index, timeout: 2000 });
					macAddress = networkIfaceReply.hwAddress;
					currIfaceName = type;
					break;
				}
			}

			// Print output
			if (macAddress) {
				this.ui.stdout.write(`Your device MAC address is ${chalk.bold.cyan(macAddress)}${os.EOL}`);
				this.ui.stdout.write(`Interface is ${_.capitalize(currIfaceName)}${os.EOL}`);
			} else {
				this.ui.stdout.write(`Your device does not have a MAC address${os.EOL}`);
			}
		} catch (err) {
			throw new VError(ensureError(err), 'Could not get MAC address');
		}

		// Clean up
		if (device && device.isOpen) {
			await device.close();
		}

		// this return value is only for unit tests
		return macAddress;
	}

	/**
	 * Inspects a Particle device and provides module info and asset info
	 * @param {string} port
	 */
	async inspectDevice({ port }) {
		let deviceFromSerialPort, deviceId, device;

		try {
			deviceFromSerialPort = await this.whatSerialPortDidYouMean(port, true);
			deviceId = deviceFromSerialPort.deviceId;
			device = await usbUtils.getOneUsbDevice({ idOrName: deviceId });
		} catch (err) {
			throw new VError(ensureError(err), 'Could not inspect device');
		}

		const platform = platformForId(device.platformId);
		this.ui.stdout.write(`Device: ${chalk.bold.cyan(deviceId)}${os.EOL}`);
		this.ui.stdout.write(`Platform: ${platform.id} - ${chalk.bold.cyan(platform.displayName)}${os.EOL}${os.EOL}`);

		try {
			await this._getModuleInfo(device);
		} catch (err) {
			throw new VError(ensureError(err), 'Could not inspect device');
		}

		// Clean up
		if (device && device.isOpen) {
			await device.close();
		}
	}

	/**
	 * Obtains module info from control requests
	 * @param {object} device
	 * @returns {boolean} returns error or true
	 */
	async _getModuleInfo(device) {
		const modules = await device.getFirmwareModuleInfo({ timeout: 5000 });

		if (modules && modules.length > 0) {
			this.ui.stdout.write(chalk.underline(`Modules${os.EOL}`));
			for (const m of modules) {
				const func = FirmwareModuleDisplayNames[m.type];
				this.ui.stdout.write(`  ${chalk.bold.cyan(_.capitalize(func))} module ${chalk.bold('#' + m.index)} - version ${chalk.bold(m.version)}${os.EOL}`);
				this.ui.stdout.write(`  Size: ${m.size/1000} kB${m.maxSize ? ` / MaxSize: ${m.maxSize/1000} kB` : ''}${os.EOL}`);

				if (m.type === 'USER_PART' && m.hash) {
					this.ui.stdout.write(`    UUID: ${m.hash}${os.EOL}`);
				}

				const errors = m.validityErrors;
				this.ui.stdout.write(`    Integrity: ${errors.includes('INTEGRITY_CHECK_FAILED') ? chalk.red('FAIL') : chalk.green('PASS')}${os.EOL}`);
				this.ui.stdout.write(`    Address Range: ${errors.includes('RANGE_CHECK_FAILED') ? chalk.red('FAIL') : chalk.green('PASS')}${os.EOL}`);
				this.ui.stdout.write(`    Platform: ${errors.includes('PLATFORM_CHECK_FAILED') ? chalk.red('FAIL') : chalk.green('PASS')}${os.EOL}`);
				this.ui.stdout.write(`    Dependencies: ${errors.includes('DEPENDENCY_CHECK_FAILED') ? chalk.red('FAIL') : chalk.green('PASS')}${os.EOL}`);

				if (m.dependencies.length > 0){
					m.dependencies.forEach((dep) => {
						const df = FirmwareModuleDisplayNames[dep.type];
						this.ui.stdout.write(`      ${_.capitalize(df)} module #${dep.index} - version ${dep.version}${os.EOL}`);
					});
				}

				if (m.assetDependencies && m.assetDependencies.length > 0) {
					const assetInfo = await device.getAssetInfo({ timeout: 5000 });
					const availableAssets = assetInfo.available;
					const requiredAssets = assetInfo.required;
					this.ui.stdout.write(`    Asset Dependencies:${os.EOL}`);
					this.ui.stdout.write(`      Required:${os.EOL}`);
					requiredAssets.forEach((asset) => {
						this.ui.stdout.write(`        ${asset.name} (${availability(asset, availableAssets) ? chalk.green('PASS') : chalk.red('FAIL')})${os.EOL}`);
					});
					const notRequiredAssets = availableAssets.filter(asset => !requiredAssets.some(requiredAsset => requiredAsset.hash === asset.hash));
					if (notRequiredAssets.length > 0) {
						this.ui.stdout.write(`      Available but not required:${os.EOL}`);
						notRequiredAssets.forEach(asset => {
							this.ui.stdout.write(`\t${asset.name}${os.EOL}`);
						});
					}
				}

				this.ui.stdout.write(`${os.EOL}`);
			}
		}
		return Promise.resolve(true);
	}

	async flashDevice(binary, { port }) {
		this.ui.stdout.write(
			`NOTE: ${chalk.bold.white('particle flash serial')} has been replaced by ${chalk.bold.white('particle flash --local')}.${os.EOL}` +
			`Please use that command going forward.${os.EOL}${os.EOL}`
		);
		const device = await this.whatSerialPortDidYouMean(port, true);
		const deviceId = device.deviceId;

		const flashCmdInstance = new FlashCommand();
		await flashCmdInstance.flashLocal({ files: [deviceId, binary], applicationOnly: true });
	}

	_scanNetworks(){
		return new Promise((resolve, reject) => {
			this.newSpin('Scanning for nearby Wi-Fi networks...').start();

			wifiScan((err, networkList) => {
				this.stopSpin();

				if (err){
					return reject(new VError('Unable to scan for Wi-Fi networks. Do you have permission to do that on this system?'));
				}
				resolve(networkList);
			});
		})
			.then(networkList => {
				// todo - if the prompt is auto answering, then only auto answer once, to prevent
				// never ending loops
				if (networkList.length === 0){
					return prompt([{
						type: 'confirm',
						name: 'rescan',
						message: 'Uh oh, no networks found. Try again?',
						default: true
					}]).then((answers) => {
						if (answers.rescan){
							return this._scanNetworks();
						}
						return [];
					});
				}

				networkList = networkList.filter((ap) => {
					if (!ap){
						return false;
					}

					// channel # > 14 === 5GHz
					if (ap.channel && parseInt(ap.channel, 10) > 14){
						return false;
					}
					return true;
				});

				networkList.sort((a, b) => {
					return a.ssid.toLowerCase().localeCompare(b.ssid.toLowerCase());
				});

				return networkList;
			});
	}

	async configureWifi({ port, file }){
		const deviceFromSerialPort = await this.whatSerialPortDidYouMean(port, true);
		const deviceId = deviceFromSerialPort.deviceId;
		const device = await usbUtils.getOneUsbDevice({ idOrName: deviceId });
		if (!deviceFromSerialPort?.specs?.features?.includes('wifi')) {
			throw new VError('The device does not support Wi-Fi');
		}

		const fwVer = device.firmwareVersion;
		await device.close();

		// XXX: Firmware version TBD
		if (semver.gte(fwVer, '6.2.0')) {
			this.ui.stdout.write(`${chalk.yellow('[Recommendation]')}${os.EOL}`);
			this.ui.stdout.write(`${chalk.yellow('Use the improved Wi-Fi configuration commands for this device-os version (>= 6.2.0)')}${os.EOL}`);
			this.ui.stdout.write(`${chalk.yellow('See \'particle wifi --help\' for more details on available commands')}${os.EOL}`);
			this.ui.stdout.write(`${os.EOL}`);
		}

		// configure serial
		if (file){
			return this._configWifiFromFile(deviceFromSerialPort, file);
		} else {
			return this.promptWifiScan(deviceFromSerialPort);
		}
	}

	_configWifiFromFile(device, filename){
		// TODO (mirande): use util.promisify once node@6 is no longer supported
		return new Promise((resolve, reject) => {
			fs.readFile(filename, 'utf8', (error, data) => {
				if (error){
					return reject(error);
				}
				return resolve(data);
			});
		})
			.then(content => {
				const opts = JSON.parse(content);
				return this.serialWifiConfig(device, opts);
			});
	}

	promptWifiScan(device){
		const question = {
			type: 'confirm',
			name: 'scan',
			message: chalk.bold.white('Should I scan for nearby Wi-Fi networks?'),
			default: true
		};

		return prompt([question])
			.then((ans) => {
				if (ans.scan){
					return this._scanNetworks().then(networks => {
						return this._getWifiInformation(device, networks);
					});
				} else {
					return this._getWifiInformation(device);
				}
			});
	}

	_removePhotonNetworks(ssids){
		return ssids.filter((ap) => {
			if (ap.indexOf('Photon-') === 0){
				return false;
			}
			return true;
		});
	}

	_getWifiInformation(device, networks){
		const rescanLabel = '[rescan networks]';

		networks = networks || [];
		const networkMap = _.keyBy(networks, 'ssid');

		let ssids = _.map(networks, 'ssid');
		ssids = this._removePhotonNetworks(ssids);

		const questions = [
			{
				type: 'list',
				name: 'ap',
				message: chalk.bold.white('Select the Wi-Fi network with which you wish to connect your device:'),
				choices: () => {
					const ns = ssids.slice();
					ns.unshift(new inquirer.Separator());
					ns.unshift(rescanLabel);
					ns.unshift(new inquirer.Separator());

					return ns;
				},
				when: () => {
					return networks.length;
				}
			},
			{
				type: 'confirm',
				name: 'detectSecurity',
				message: chalk.bold.white('Should I try to auto-detect the wireless security type?'),
				when: (answers) => {
					return !!answers.ap && !!networkMap[answers.ap] && !!networkMap[answers.ap].security;
				},
				default: true
			}
		];

		return prompt(questions)
			.then(answers => {
				if (answers.ap === rescanLabel){
					return this._scanNetworks().then(networks => {
						return this._getWifiInformation(device, networks);
					});
				}

				const network = answers.ap;
				const ap = networkMap[network];
				const security = answers.detectSecurity && ap && ap.security;

				if (security){
					console.log(arrow, 'Detected', security, 'security');
				}

				return this.serialWifiConfig(device, { network, security });
			});
	}

	/**
	 * This is a wrapper function so _serialWifiConfig can return the
	 * true promise state for testing.
	 */
	serialWifiConfig(...args) {
		return this._serialWifiConfig(...args)
			.then(() => {
				console.log('Done! Your device should now restart.');
			}, (err) => {
				if (err && err.message) {
					log.error('Something went wrong:', err.message);
				} else {
					log.error('Something went wrong:', err);
				}
			});
	}

	/* eslint-disable max-statements */
	_serialWifiConfig(device, opts = {}){
		if (!device){
			return Promise.reject('No serial port available');
		}

		log.verbose('Attempting to configure Wi-Fi on ' + device.port);

		let isEnterprise = false;
		const self = this;
		let cleanUpFn;
		const promise = new Promise((resolve, reject) => {
			const serialPort = self.serialPort || new SerialPort({ path: device.port, ...SERIAL_PORT_DEFAULTS });
			const parser = new SerialBatchParser({ timeout: 250 });

			cleanUpFn = () => {
				resetTimeout();
				serialPort.removeListener('close', serialClosedEarly);
				return new Promise((resolve) => {
					serialPort.close(resolve);
				});
			};
			serialPort.pipe(parser);
			serialPort.on('error', (err) => reject(err));
			serialPort.on('close', serialClosedEarly);

			const serialTrigger = new SerialTrigger(serialPort, parser);

			serialTrigger.addTrigger('SSID:', (cb) => {
				resetTimeout();

				if (opts.network){
					return cb(opts.network + '\n');
				}

				const question = {
					type: 'input',
					name: 'ssid',
					message: 'SSID',
					validate: (input) => {
						if (!input || !input.trim()){
							return 'Please enter a valid SSID';
						} else {
							return true;
						}
					},
					filter: (input) => {
						return input.trim();
					}
				};

				prompt([question])
					.then((ans) => {
						cb(ans.ssid + '\n', startTimeout.bind(self, 5000));
					});
			});

			serialTrigger.addTrigger('Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2:', parsesecurity.bind(null, false));
			serialTrigger.addTrigger('Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2, 4=WPA Enterprise, 5=WPA2 Enterprise:', parsesecurity.bind(null, true));

			serialTrigger.addTrigger('Security Cipher 1=AES, 2=TKIP, 3=AES+TKIP:', (cb) => {
				resetTimeout();
				if (opts.security !== undefined){
					let cipherType = 1;
					if (opts.security.indexOf('AES') >= 0 && opts.security.indexOf('TKIP') >= 0){
						cipherType = 3;
					} else if (opts.security.indexOf('TKIP') >= 0){
						cipherType = 2;
					} else if (opts.security.indexOf('AES') >= 0){
						cipherType = 1;
					}

					return cb(cipherType + '\n', startTimeout.bind(self, 5000));
				}

				const question = {
					type: 'list',
					name: 'cipher',
					message: 'Cipher Type',
					choices: [
						{ name: 'AES+TKIP', value: 3 },
						{ name: 'TKIP', value: 2 },
						{ name: 'AES', value: 1 }
					]
				};

				prompt([question])
					.then((ans) => {
						cb(ans.cipher + '\n', startTimeout.bind(self, 5000));
					});
			});

			serialTrigger.addTrigger('EAP Type 0=PEAP/MSCHAPv2, 1=EAP-TLS:', (cb) => {
				resetTimeout();

				isEnterprise = true;

				if (opts.eap !== undefined){
					let eapType = 0;
					if (opts.eap.toLowerCase().indexOf('peap') >= 0){
						eapType = 0;
					} else if (opts.eap.toLowerCase().indexOf('tls')){
						eapType = 1;
					}
					return cb(eapType + '\n', startTimeout.bind(self, 5000));
				}

				const question = {
					type: 'list',
					name: 'eap',
					message: 'EAP Type',
					choices: [
						{ name: 'PEAP/MSCHAPv2', value: 0 },
						{ name: 'EAP-TLS', value: 1 }
					]
				};

				prompt([question])
					.then((ans) => {
						cb(ans.eap + '\n', startTimeout.bind(self, 5000));
					});
			});

			serialTrigger.addTrigger('Username:', (cb) => {
				resetTimeout();

				if (opts.username){
					cb(opts.username + '\n', startTimeout.bind(self, 15000));
				} else {
					const question = {
						type: 'input',
						name: 'username',
						message: 'Username',
						validate: (val) => {
							return !!val;
						}
					};

					prompt([question])
						.then((ans) => {
							cb(ans.username + '\n', startTimeout.bind(self, 15000));
						});
				}
			});

			serialTrigger.addTrigger('Outer identity (optional):', (cb) => {
				resetTimeout();

				if (opts.outer_identity){
					cb(opts.outer_identity.trim + '\n', startTimeout.bind(self, 15000));
				} else {
					const question = {
						type: 'input',
						name: 'outer_identity',
						message: 'Outer identity (optional)'
					};

					prompt([question])
						.then((ans) => {
							cb(ans.outer_identity + '\n', startTimeout.bind(self, 15000));
						});
				}
			});

			serialTrigger.addTrigger('Client certificate in PEM format:', (cb) => {
				resetTimeout();

				if (opts.client_certificate){
					cb(opts.client_certificate.trim() + '\n\n', startTimeout.bind(self, 15000));
				} else {
					const question = {
						type: 'editor',
						name: 'client_certificate',
						message: 'Client certificate in PEM format',
						validate: (val) => {
							return !!val;
						}
					};

					prompt([question])
						.then((ans) => {
							cb(ans.client_certificate.trim() + '\n\n', startTimeout.bind(self, 15000));
						});
				}
			});

			serialTrigger.addTrigger('Private key in PEM format:', (cb) => {
				resetTimeout();

				if (opts.private_key){
					cb(opts.private_key.trim() + '\n\n', startTimeout.bind(self, 15000));
				} else {
					const question = {
						type: 'editor',
						name: 'private_key',
						message: 'Private key in PEM format',
						validate: (val) => {
							return !!val;
						}
					};

					prompt([question])
						.then((ans) => {
							cb(ans.private_key.trim() + '\n\n', startTimeout.bind(self, 15000));
						});
				}
			});

			serialTrigger.addTrigger('Root CA in PEM format (optional):', (cb) => {
				resetTimeout();

				if (opts.root_ca){
					cb(opts.root_ca.trim() + '\n\n', startTimeout.bind(self, 15000));
				} else {
					const questions = [
						{
							type: 'confirm',
							name: 'provide_root_ca',
							message: 'Would you like to provide CA certificate?',
							default: true
						},
						{
							type: 'editor',
							name: 'root_ca',
							message: 'CA certificate in PEM format',
							when: (answers) => {
								return answers.provide_root_ca;
							},
							validate: (val) => {
								return !!val;
							},
							default: ''
						}
					];

					prompt(questions)
						.then((ans) => {
							if (ans.root_ca === undefined){
								ans.root_ca = '';
							}
							cb(ans.root_ca.trim() + '\n\n', startTimeout.bind(self, 15000));
						});
				}
			});

			serialTrigger.addTrigger('Password:', (cb) => {
				resetTimeout();
				// Skip password prompt as appropriate
				if (opts.password){
					cb(opts.password + '\n', startTimeout.bind(self, 15000));
				} else {
					const question = {
						type: 'input',
						name: 'password',
						message: !isEnterprise ? 'Wi-Fi Password' : 'Password',
						validate: (val) => {
							return !!val;
						}
					};

					prompt([question])
						.then((ans) => {
							cb(ans.password + '\n', startTimeout.bind(self, 15000));
						});
				}
			});

			serialTrigger.addTrigger('Spark <3 you!', () => {
				resetTimeout();
				resolve();
			});

			serialTrigger.addTrigger('Particle <3 you!', () => {
				resetTimeout();
				resolve();
			});

			serialPort.open((err) => {
				if (err){
					return reject(err);
				}

				serialTrigger.start(true);
				serialPort.write('w');
				serialPort.drain();

				// In case device is not in listening mode.
				startTimeout(5000, 'Serial timed out while initially listening to device, please ensure device is in listening mode with particle usb start-listening', 'InitialTimeoutError');
			});

			function serialClosedEarly(){
				reject('Serial port closed early');
			}

			function startTimeout(to, message = timeoutError, name = 'TimeoutError'){
				self._serialTimeout = setTimeout(() => {
					reject(new VError({ name }, message));
				}, to);
			}

			function resetTimeout(){
				clearTimeout(self._serialTimeout);
				self._serialTimeout = null;
			}

			function parsesecurity(ent, cb){
				resetTimeout();

				if (opts.security){
					let security = 3;

					if (opts.security.indexOf('WPA2') >= 0 && opts.security.indexOf('802.1x') >= 0){
						security = 5;
						isEnterprise = true;
					} else if (opts.security.indexOf('WPA') >= 0 && opts.security.indexOf('802.1x') >= 0){
						security = 4;
						isEnterprise = true;
					} else if (opts.security.indexOf('WPA2') >= 0){
						security = 3;
					} else if (opts.security.indexOf('WPA') >= 0){
						security = 2;
					} else if (opts.security.indexOf('WEP') >= 0){
						security = 1;
					} else if (opts.security.indexOf('NONE') >= 0){
						security = 0;
					}

					return cb(security + '\n', startTimeout.bind(self, 10000));
				}

				const choices = [
					{ name: 'WPA2', value: 3 },
					{ name: 'WPA', value: 2 },
					{ name: 'WEP', value: 1 },
					{ name: 'Unsecured', value: 0 }
				];

				if (ent){
					choices.push({ name: 'WPA Enterprise', value: 4 });
					choices.push({ name: 'WPA2 Enterprise', value: 5 });
				}

				const question = {
					type: 'list',
					name: 'security',
					message: 'Security Type',
					choices: choices
				};

				prompt([question])
					.then((ans) => {
						if (ans.security > 3){
							isEnterprise = true;
						}
						cb(ans.security + '\n', startTimeout.bind(self, 10000));
					});
			}
		});

		return promise.finally(cleanUpFn);
	}

	// TODO: If the comPort does not have an exact match with the device,
	// throw an error and return
	_parsePort(devices, comPort){
		if (!comPort){
			//they didn't give us anything.
			if (devices.length === 1){
				//we have exactly one device, use that.
				return devices[0];
			}
			//else - which one?
		} else {
			let portNum = parseInt(comPort);

			if (!isNaN(portNum)){
				//they gave us a number
				if (portNum > 0){
					portNum -= 1;
				}

				if (devices.length > portNum){
					//we have it, use it.
					return devices[portNum];
				}
				//else - which one?
			} else {
				const matchedDevices = devices.filter((d) => {
					return d.port === comPort;
				});

				if (matchedDevices.length){
					return matchedDevices[0];
				}

				//they gave us a string
				//doesn't matter if we have it or not, give it a try.
				return { port: comPort, type: '' };
			}
		}

		return null;
	}

	/**
	 * Converts the specified comPort into a device object. If comPort is provided,
	 * the device is obtained based on that port. If comPort is not specified,
	 * the device is obtained from the selected port within the function.
	 *
	 * @param {string|null} comPort - Example port on Mac/Linux (/dev/tty.usbmodem123456)
	 * @returns {object} - The resulting device object
	 */
	async whatSerialPortDidYouMean(comPort) {
		const devices = await this.findDevices();
		const port = this._parsePort(devices, comPort);
		if (port) {
			if (!port.deviceId) {
				throw new Error('No serial port identified');
			}
			return port;
		}

		if (!devices || devices.length === 0) {
			throw new Error('No serial port identified');
		}

		const question = {
			name: 'port',
			type: 'list',
			message: 'Which device did you mean?',
			choices: devices.map((d) => {
				return {
					name: d.port + ' - ' + d.type + ' - ' + d.deviceId,
					value: d
				};
			})
		};

		const answers = await prompt([question]);
		const portSelected = answers.port;
		if (!portSelected || !portSelected.deviceId) {
			throw new Error('No serial port identified');
		}
		return portSelected;
	}

	exit(){
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(arrow, chalk.bold.white('Ok, bye! Don\'t forget `' +
			chalk.bold.cyan(cmd + ' help') + '` if you\'re stuck!',
		chalk.bold.magenta('<3'))
		);
		process.exit(0);
	}

	getDeviceInfoFromSerial(device){
		return this._issueSerialCommand(device, 'i', IDENTIFY_COMMAND_TIMEOUT)
			.then((data) => {
				const matches = data.match(/Your (core|device) id is\s+(\w+)/);

				if (matches && matches.length === 3){
					return matches[2];
				}

				const electronMatches = data.match(/\s+([a-fA-F0-9]{24})\s+/);

				if (electronMatches && electronMatches.length === 2){
					const info = { id: electronMatches[1] };
					const imeiMatches = data.match(/IMEI: (\w+)/);

					if (imeiMatches){
						info.imei = imeiMatches[1];
					}

					const iccidMatches = data.match(/ICCID: (\w+)/);

					if (iccidMatches){
						info.iccid = iccidMatches[1];
					}

					return info;
				}
			});
	}

	/* eslint-enable max-statements */

	/**
	 * Sends a command to the device and retrieves the response.
	 * @param devicePort The device port to send the command to
	 * @param command   The command text
	 * @param timeout   How long in milliseconds to wait for a response
	 * @returns {Promise} to send the command.
	 * The serial port should not be open, and is closed after the command is sent.
	 * @private
	 */
	_issueSerialCommand(device, command, timeout){
		if (!device){
			throw new VError('No serial port identified');
		}
		const failDelay = timeout || 5000;

		let serialPort;
		return new Promise((resolve, reject) => {
			serialPort = new SerialPort({ path: device.port, ...SERIAL_PORT_DEFAULTS });
			const parser = new SerialBatchParser({ timeout: 250 });
			serialPort.pipe(parser);

			const failTimer = setTimeout(() => {
				reject(timeoutError);
			}, failDelay);

			parser.on('data', (data) => {
				clearTimeout(failTimer);
				resolve(data.toString());
			});

			serialPort.open((err) => {
				if (err){
					console.error('Serial err: ' + err);
					console.error('Serial problems, please reconnect the device.');
					reject('Serial problems, please reconnect the device.');
					return;
				}

				serialPort.write(command, (werr) => {
					if (werr){
						reject(err);
					}
				});
			});
		})
			.finally(() => {
				if (serialPort){
					serialPort.removeAllListeners('open');

					if (serialPort.isOpen){
						return new Promise((resolve) => {
							serialPort.close(resolve);
						});
					}
				}
			});
	}
};

