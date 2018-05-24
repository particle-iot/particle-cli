const VError = require('verror');
const _ = require('lodash');
const fs = require('fs');
const prompt = require('inquirer').prompt;
const path = require('path');
const when = require('when');
const sequence = require('when/sequence');
const inquirer = require('inquirer');
const log = require('../lib/log');
const chalk = require('chalk');
let SerialPort;
try {
	SerialPort = require('serialport');
} catch (err) {
	log.fatal(`Please reinstall the CLI again using ${chalk.bold('npm install -g particle-cli')}`);
}
const wifiScan = require('node-wifiscanner2').scan;
const specs = require('../lib/deviceSpecs');
const ApiClient = require('../lib/ApiClient2');
const OldApiClient = require('../lib/ApiClient');
const settings = require('../../settings');
const DescribeParser = require('binary-version-reader').HalDescribeParser;
const YModem = require('../lib/ymodem');

const SerialBatchParser = require('../lib/SerialBatchParser');
const SerialTrigger = require('../lib/SerialTrigger');
const spinnerMixin = require('../lib/spinnerMixin');
const ensureError = require('../lib/utilities').ensureError;

// TODO: DRY this up somehow
// The categories of output will be handled via the log class, and similar for protip.
const cmd = path.basename(process.argv[1]);
const arrow = chalk.green('>');
const alert = chalk.yellow('!');
const protip = () => {
	const args = Array.prototype.slice.call(arguments);
	args.unshift(chalk.cyan('!'), chalk.bold.white('PROTIP:'));
	console.log.apply(null, args);
};

const timeoutError = 'Serial timed out';

class SerialCommand {
	constructor(options) {
		spinnerMixin(this);
		this.options = options;
	}

	findDevices() {
		return SerialPort.list().then(ports => {
			const devices = [];

			ports.forEach((port) => {
				// manufacturer value
				// Mac - Spark devices
				// Devices on old driver - Spark Core, Photon
				// Devices on new driver - Particle IO (https://github.com/spark/firmware/pull/447)
				// Windows only contains the pnpId field

				let device;
				const serialDeviceSpec = _.find(specs, (deviceSpec) => {
					if (!deviceSpec.serial) {
						return false;
					}
					const vid = deviceSpec.serial.vid;
					const pid = deviceSpec.serial.pid;
					const serialNumber = deviceSpec.serial.serialNumber;

					const usbMatches = (port.vendorId === vid.toLowerCase() && port.productId === pid.toLowerCase());
					const pnpMatches = !!(port.pnpId && (port.pnpId.indexOf('VID_' + vid.toUpperCase()) >= 0) && (port.pnpId.indexOf('PID_' + pid.toUpperCase()) >= 0));
					const serialNumberMatches = port.serialNumber && port.serialNumber.indexOf(serialNumber) >= 0;

					return !!(usbMatches || pnpMatches || serialNumberMatches);

				});
				if (serialDeviceSpec) {
					device = {
						port: port.comName,
						type: serialDeviceSpec.productName,
						deviceId: serialDeviceSpec.serial.deviceId && serialDeviceSpec.serial.deviceId(port.serialNumber || port.pnpId),
						specs: serialDeviceSpec
					};
				}

				const matchesManufacturer = port.manufacturer && (port.manufacturer.indexOf('Particle') >= 0 || port.manufacturer.indexOf('Spark') >= 0 || port.manufacturer.indexOf('Photon') >= 0);
				if (!device && matchesManufacturer) {
					device = { port: port.comName, type: 'Core' };
				}

				if (device) {
					devices.push(device);
				}
			});

			//if I didn't find anything, grab any 'ttyACM's
			if (devices.length === 0) {
				ports.forEach((port) => {
					//if it doesn't have a manufacturer or pnpId set, but it's a ttyACM port, then lets grab it.
					if (port.comName.indexOf('/dev/ttyACM') === 0) {
						devices.push({ port: port.comName, type: '' });
					} else if (port.comName.indexOf('/dev/cuaU') === 0) {
						devices.push({ port: port.comName, type: '' });
					}
				});
			}

			return devices;
		}).catch(err => {
			throw new VError(err, 'Error listing serial ports');
		});
	}

	listDevices() {
		return this.findDevices().then(devices => {
			if (devices.length === 0) {
				console.log(chalk.bold.white('No devices available via serial'));
				return;
			}

			console.log('Found', chalk.cyan(devices.length), (devices.length > 1 ? 'devices' : 'device'), 'connected via serial:');
			devices.forEach((device) => {
				console.log(`${device.port} - ${device.type}`);
			});
		});
	}

	monitorPort() {
		const comPort = this.options.port;
		let cleaningUp = false;
		let selectedDevice;
		let serialPort;
		const follow = this.options.follow;

		const displayError = (err) => {
			if (err) {
				console.error('Serial err: ' + err);
				console.error('Serial problems, please reconnect the device.');
			}
		};

		// Called when port closes
		const handleClose = () => {
			if (follow && !cleaningUp) {
				console.log(chalk.bold.white('Serial connection closed.  Attempting to reconnect...'));
				reconnect();
			} else {
				console.log(chalk.bold.white('Serial connection closed.'));
			}
		};

		// Handle interrupts and close the port gracefully
		const handleInterrupt = () => {
			if (!cleaningUp) {
				console.log(chalk.bold.red('Caught Interrupt.  Cleaning up.'));
				cleaningUp = true;
				if (serialPort && serialPort.isOpen) {
					serialPort.close();
				}
			}
		};

		// Called only when the port opens successfully
		const handleOpen = () => {
			console.log(chalk.bold.white('Serial monitor opened successfully:'));
		};

		const handlePortFn = (device) => {
			if (!device) {
				if (follow) {
					setTimeout(() => {
						this.whatSerialPortDidYouMean(comPort, true, handlePortFn);
					}, 5);
					return;
				} else {
					console.error(chalk.bold.white('No serial device identified'));
					return;
				}
			}

			console.log('Opening serial monitor for com port: "' + device.port + '"');
			selectedDevice = device;
			openPort();
		};

		function openPort() {
			serialPort = new SerialPort(selectedDevice.port, {
				baudRate: 9600,
				autoOpen: false
			});
			serialPort.on('close', handleClose);
			serialPort.on('readable', () => {
				process.stdout.write(serialPort.read().toString());
			});
			serialPort.on('error', displayError);
			serialPort.open((err) => {
				if (err && follow) {
					reconnect(selectedDevice);
				} else if (err) {
					displayError(err);
				} else {
					handleOpen();
				}
			});
		}

		function reconnect() {
			setTimeout(() => {
				openPort(selectedDevice);
			}, 5);
		}

		process.on('SIGINT', handleInterrupt);
		process.on('SIGQUIT', handleInterrupt);
		process.on('SIGTERM', handleInterrupt);
		process.on('exit', handleInterrupt);

		if (follow) {
			console.log('Polling for available serial device...');
		}

		this.whatSerialPortDidYouMean(comPort, true, handlePortFn);
	}

	/**
	 * Check to see if the device is in listening mode, try to get the device ID via serial
	 * @param {Number|String} comPort
	 */
	identifyDevice() {
		const comPort = this.options.port;

		return this.whatSerialPortDidYouMean(comPort, true).then(device => {
			if (!device) {
				throw new VError('No serial port identified');
			}

			return this.askForDeviceID(device);
		}).then(data => {
			if (_.isObject(data)) {
				console.log();
				console.log('Your device id is', chalk.bold.cyan(data.id));
				if (data.imei) {
					console.log('Your IMEI is', chalk.bold.cyan(data.imei));
				}
				if (data.iccid) {
					console.log('Your ICCID is', chalk.bold.cyan(data.iccid));
				}
			} else {
				console.log();
				console.log('Your device id is', chalk.bold.cyan(data));
			}

			return this.askForSystemFirmwareVersion(device, 2000).then(version => {
				console.log('Your system firmware version is', chalk.bold.cyan(version));
			}).catch(() => {
				console.log('Unable to determine system firmware version');
			});
		}).catch((err) => {
			throw new VError(err, 'Could not identify device');
		});
	}

	deviceMac() {
		const comPort = this.options.port;

		return this.whatSerialPortDidYouMean(comPort, true).then(device => {
			if (!device) {
				throw new VError('No serial port identified');
			}

			return this.getDeviceMacAddress(device);
		}).then(data => {
			console.log();
			console.log('Your device MAC address is', chalk.bold.cyan(data));
		}).catch((err) => {
			throw new VError(err, 'Could not get MAC address');
		});
	}

	inspectDevice() {
		const comPort = this.options.port;

		this.whatSerialPortDidYouMean(comPort, true, (device) => {
			if (!device) {
				return this.error('No serial port identified');
			}

			const functionMap = {
				s: 'System',
				u: 'User',
				b: 'Bootloader',
				r: 'Reserved',
				m: 'Monolithic'
			};
			const locationMap = {
				m: 'main',
				b: 'backup',
				f: 'factory',
				t: 'temp'
			};

			this.getSystemInformation(device)
				.then((data) => {
					const d = JSON.parse(data);
					const parser = new DescribeParser();
					const modules = parser.getModules(d);

					if (d.p !== undefined) {
						const platformName = settings.knownPlatforms[d.p];
						console.log('Platform:', d.p, platformName ? ('- ' + chalk.bold.cyan(platformName)) : '');
					}
					if (modules && modules.length > 0) {
						console.log(chalk.underline('Modules'));
						modules.forEach((m) => {
							const func = functionMap[m.func];
							if (!func) {
								console.log(`  empty - ${locationMap[m.location]} location, ${m.maxSize} bytes max size`);
								return;
							}

							console.log(`  ${chalk.bold.cyan(func)} module ${chalk.bold('#' + m.name)} - version ${chalk.bold(m.version)}, ${locationMap[m.location]} location, ${m.maxSize} bytes max size`);

							if (m.isUserModule() && m.uuid) {
								console.log('    UUID:', m.uuid);
							}

							console.log('    Integrity: %s', m.hasIntegrity() ? chalk.green('PASS') : chalk.red('FAIL'));
							console.log('    Address Range: %s', m.isImageAddressInRange() ? chalk.green('PASS') : chalk.red('FAIL'));
							console.log('    Platform: %s', m.isImagePlatformValid() ? chalk.green('PASS') : chalk.red('FAIL'));
							console.log('    Dependencies: %s', m.areDependenciesValid() ? chalk.green('PASS') : chalk.red('FAIL'));
							if (m.dependencies.length > 0) {
								m.dependencies.forEach((dep) => {
									const df = functionMap[dep.func];
									console.log(`      ${df} module #${dep.name} - version ${dep.version}`);
								});
							}
						});
					}
				})
				.catch((err) => {
					this.error(err, false);
				});
		});
	}

	_promptForListeningMode() {
		return when.promise((resolve, reject) => {
			console.log(
				chalk.cyan('!'),
				'PROTIP:',
				chalk.white('Hold the'),
				chalk.cyan('SETUP'),
				chalk.white('button on your device until it'),
				chalk.cyan('blinks blue!')
			);

			prompt([
				{
					type: 'input',
					name: 'listening',
					message: 'Press ' + chalk.bold.cyan('ENTER') + ' when your device is blinking ' + chalk.bold.blue('BLUE')
				}
			]).then(() => {
				resolve();
			});
		});
	}

	flashDevice() {
		const comPort = this.options.port;
		let firmware = this.options.params.binary;
		settings.verboseOutput = false;

		this._promptForListeningMode().then(() => {
			this.whatSerialPortDidYouMean(comPort, true, (device) => {
				if (!device) {
					return this.error('No serial port identified');
				}
				if (device.type === 'Core') {
					return this.error('serial flashing is not supported on the Core');
				}

				const complete = sequence([
					() => {
						//only match against knownApp if file is not found
						let stats;
						try {
							stats = fs.statSync(firmware);
						} catch (ex) {
							// file does not exist
							const specsByProduct = _.indexBy(specs, 'productName');
							const productSpecs = specsByProduct[device.type];
							firmware = productSpecs && productSpecs.knownApps[firmware];
							if (firmware === undefined) {
								return when.reject('file does not exist and no known app found.');
							} else {
								return;
							}
						}

						if (!stats.isFile()) {
							return when.reject('You cannot flash a directory over USB');
						}
					},
					() => {
						const serialPort = new SerialPort(device.port, {
							baudRate: 28800,
							autoOpen: false
						});

						const closePort = () => {
							if (serialPort.isOpen) {
								serialPort.close();
							}
							process.exit(0);
						};
						process.on('SIGINT', closePort);
						process.on('SIGTERM', closePort);

						const ymodem = new YModem(serialPort, { debug: true });
						return ymodem.send(firmware);
					}
				]);

				return complete.then(() => {
					console.log('\nFlash success!');
				}, (err) =>	{
					this.error('\nError writing firmware...' + err + '\n' + err.stack, true);
				});
			});
		});
	}

	_scanNetworks(next) {
		this.newSpin('Scanning for nearby Wi-Fi networks...').start();

		wifiScan((err, networkList) => {
			this.stopSpin();

			if (err) {
				return this.error('Unable to scan for Wi-Fi networks. Do you have permission to do that on this system?');
			}

			// todo - if the prompt is auto answering, then only auto answer once, to prevent
			// never ending loops
			if (networkList.length === 0) {
				prompt([{
					type: 'confirm',
					name: 'rescan',
					message: 'Uh oh, no networks found. Try again?',
					default: true
				}]).then((answers) => {
					if (answers.rescan) {
						return this._scanNetworks(next);
					}
					return next([]);
				});
				return;
			}

			networkList = networkList.filter((ap) => {
				if (!ap) {
					return false;
				}

				// channel # > 14 === 5GHz
				if (ap.channel && parseInt(ap.channel, 10) > 14) {
					return false;
				}
				return true;
			});

			networkList.sort((a, b) => {
				return a.ssid.toLowerCase().localeCompare(b.ssid.toLowerCase());
			});
			next(networkList);
		});
	}

	configureWifi() {
		const comPort = this.options.port;
		const credentialsFile = this.options.file;

		// TODO remove once we have verbose flag
		settings.verboseOutput = true;

		const wifi = when.defer();

		this.whatSerialPortDidYouMean(comPort, true, (device) => {
			if (!device) {
				return this.error('No serial port identified');
			}

			if (credentialsFile) {
				this._configWifiFromFile(wifi, device, credentialsFile);
			} else {
				this._promptWifiScan(wifi, device);
			}
		});

		return wifi.promise;
	}

	_configWifiFromFile(wifi, device, filename) {
		fs.readFile(filename, 'utf-8', (err, content) => {
			if (err) {
				return wifi.reject(err);
			}

			let opts;
			try {
				opts = JSON.parse(content);
			} catch (err) {
				return wifi.reject(err);
			}

			this.serialWifiConfig(device, opts).then(wifi.resolve, wifi.reject);
		});
	}

	_promptWifiScan(wifi, device) {
		prompt([
			{
				type: 'confirm',
				name: 'scan',
				message: chalk.bold.white('Should I scan for nearby Wi-Fi networks?'),
				default: true
			}
		]).then((ans) => {
			if (ans.scan) {
				return this._scanNetworks((networks) => {
					this._getWifiInformation(device, networks).then(wifi.resolve, wifi.reject);
				});
			} else {
				this._getWifiInformation(device).then(wifi.resolve, wifi.reject);
			}
		});
	}

	_jsonErr(err) {
		return console.log(chalk.red('!'), 'An error occurred:', err);
	}

	_removePhotonNetworks(ssids) {
		return ssids.filter((ap) => {
			if (ap.indexOf('Photon-') === 0) {
				return false;
			}
			return true;
		});
	}

	_getWifiInformation(device, networks) {
		const wifiInfo = when.defer();
		const rescanLabel = '[rescan networks]';

		networks = networks || [];
		const networkMap = _.indexBy(networks, 'ssid');

		let ssids = _.pluck(networks, 'ssid');
		ssids = this._removePhotonNetworks(ssids);

		prompt([
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
		]).then((answers) => {
			if (answers.ap === rescanLabel) {
				return this._scanNetworks((networks) => {
					this._getWifiInformation(device, networks).then(wifiInfo.resolve, wifiInfo.reject);
				});
			}

			const network = answers.ap;
			const ap = networkMap[network];
			const security = answers.detectSecurity && ap && ap.security;
			if (security) {
				console.log(arrow, 'Detected', security, 'security');
			}

			this.serialWifiConfig(device, { network, security }).then(wifiInfo.resolve, wifiInfo.reject);
		});

		return wifiInfo.promise;
	}

	supportsClaimCode(device) {
		if (!device) {
			return when.reject('No serial port available');
		}
		return this._issueSerialCommand(device, 'c', 500).then((data) => {
			const matches = data.match(/Device claimed: (\w+)/);
			return !!matches;
		}).catch((err) => {
			if (err !== timeoutError) {
				throw err;
			}
			return false;
		});
	}

	/**
	 * Performs device setup via serial. The device should already be in listening mode.
	 * Setup comprises these steps:
	 * - fetching the claim code from the API
	 * - setting the claim code on the device
	 * - configuring
	 * @param device
	 */
	setup(device) {
		const self = this;
		let _deviceID = '';
		const api = new ApiClient();

		function afterClaim(err, dat) {
			self.stopSpin();
			if (err) {
				// TODO: Graceful recovery here
				// How about retrying the claim code again
				// console.log(arrow, arrow, err);
				if (err.code === 'ENOTFOUND') {
					protip("Your computer couldn't find the cloud...");
				}
				if (!err.code && err.message) {
					protip(err.message);
				} else {
					protip('There was a network error while connecting to the cloud...');
					protip('We need an active internet connection to successfully complete setup.');
					protip('Are you currently connected to the internet? Please double-check and try again.');
				}
				return;
			}

			console.log(arrow, 'Obtained magical secure claim code.');
			console.log();
			return self.sendClaimCode(device, dat.claim_code)
				.then(() => {
					console.log('Claim code set. Now setting up Wi-Fi');
					// todo - add additional commands over USB to have the device scan for Wi-Fi
					const wifi = when.defer();
					self._promptWifiScan(wifi, device);
					return wifi.promise;
				})
				.then(revived);
		}

		function getClaim() {
			self.newSpin('Obtaining magical secure claim code from the cloud...').start();
			api.getClaimCode(undefined, afterClaim);
		}

		function revived() {
			self.stopSpin();
			self.newSpin("Attempting to verify the Photon's connection to the cloud...").start();

			setTimeout(() => {
				api.listDevices(checkDevices);
			}, 6000);
		}

		function checkDevices(err, dat) {
			self.stopSpin();
			if (err) {
				if (err.code === 'ENOTFOUND') {
					// todo - limit the number of retries here.
					console.log(alert, 'Network not ready yet, retrying...');
					console.log();
					return revived(null);
				}
				console.log(alert, 'Unable to verify your Photon\'s connection.');
				console.log(alert, "Please make sure you're connected to the internet.");
				console.log(alert, 'Then try', chalk.bold.cyan(cmd + ' list'), "to verify it's connected.");
				self.exit();
			}

			// self.__deviceID -> _deviceID
			const onlinePhoton = _.find(dat, (device) => {
				return (device.id.toUpperCase() === _deviceID.toUpperCase()) && device.connected === true;
			});

			if (onlinePhoton) {
				console.log(arrow, 'It looks like your Photon has made it happily to the cloud!');
				console.log();
				namePhoton(onlinePhoton.id);
				return;
			}

			console.log(alert, "It doesn't look like your Photon has made it to the cloud yet.");
			console.log();
			prompt([{

				type: 'list',
				name: 'recheck',
				message: 'What would you like to do?',
				choices: [
					{ name: 'Check again to see if the Photon has connected', value: 'recheck' },
					{ name: 'Reconfigure the Wi-Fi settings of the Photon', value: 'reconfigure' }
				]

			}]).then(recheck);

			function recheck(ans) {
				if (ans.recheck === 'recheck') {
					api.listDevices(checkDevices);
				} else {
					self._promptForListeningMode();
					self.setup(device);
				}
			}
		}

		function namePhoton(deviceId) {
			const __oldapi = new OldApiClient();

			prompt([
				{
					type: 'input',
					name: 'deviceName',
					message: 'What would you like to call your Photon (Enter to skip)?'
				}
			]).then((ans) => {
				// todo - retrieve existing name of the device?
				const deviceName = ans.deviceName;
				if (deviceName) {
					__oldapi.renameDevice(deviceId, deviceName).then(() => {
						console.log();
						console.log(arrow, 'Your Photon has been given the name', chalk.bold.cyan(deviceName));
						console.log(arrow, "Congratulations! You've just won the internet!");
						console.log();
						self.exit();
					}, (err) => {
						console.error(alert, 'Error naming your Photon: ', err);
						namePhoton(deviceId);
					});
				} else {
					console.log('Skipping device naming.');
					self.exit();
				}
			});
		}

		return this.askForDeviceID(device).then((deviceID) => {
			_deviceID = deviceID;
			console.log('setting up device', deviceID);
			return getClaim();
		})
			.catch((err) => {
				this.stopSpin();
				console.log(err);
				throw err;
			});
	}

	setDeviceClaimCode(device, claimCode) {
		return this.supportsClaimCode(device).then((supported) => {
			if (!supported) {
				return when.reject('device does not support claiming over USB');
			}

			return this.sendClaimCode(device, claimCode);
		});
	}

	claimDevice() {
		const comPort = this.options.port;
		const claimCode = this.options.params.claimCode;

		return this.whatSerialPortDidYouMean(comPort, true, (device) => {
			return this.sendClaimCode(device, claimCode)
				.then(() => {
					console.log('Claim code set.');
					return true;
				});
		});
	}

	sendClaimCode(device, claimCode) {
		const expectedPrompt = 'Enter 63-digit claim code: ';
		const confirmation = 'Claim code set to: ' + claimCode;
		return this.doSerialInteraction(device, 'C', [
			[expectedPrompt, 2000, (promise, next) => {
				next(claimCode + '\n');
			}],
			[confirmation, 2000, (promise, next) => {
				next();
				promise.resolve();
			}]
		]);
	}

	/**
	 *
	 * @param {Device} device        The device to interact with
	 * @param {String} command      The initial command to send to the device
	 * @param {Array} interactions  an array of interactions. Each interaction is
	 *  an array, with these elements:
	 *  [0] - the prompt text to interact with
	 *  [1] - the timeout to wait for this prompt
	 *  [2] - the callback when the prompt has been received. The callback takes
	 *      these arguments:
	 *          promise: the deferred result (call resolve/reject)
	 *          next: the response callback, should be called with (response) to send a response.
	 *              Response can be undefined
	 * @returns {Promise}
	 */
	doSerialInteraction(device, command, interactions) {
		if (!device) {
			return when.reject('No serial port available');
		}

		if (!interactions.length) {
			return when.resolve();
		}

		const serialPort = this.serialPort || new SerialPort(device.port, {
			baudRate: 9600,
			autoOpen: false
		});
		const parser = new SerialBatchParser({ timeout: 250 });
		serialPort.pipe(parser);

		const done = when.defer();
		serialPort.on('error', (err) => {
			done.reject(err);
		});
		const serialClosedEarly = () => {
			done.reject('Serial port closed early');
		};
		serialPort.on('close', serialClosedEarly);

		const startTimeout = (to) => {
			this._serialTimeout = setTimeout(() => {
				done.reject('Serial timed out');
			}, to);
		};

		const resetTimeout = () => {
			clearTimeout(this._serialTimeout);
			this._serialTimeout = null;
		};

		const st = new SerialTrigger(serialPort, parser);

		const addTrigger = (expectedPrompt, timeout, callback) => {
			st.addTrigger(expectedPrompt, (cb) => {
				resetTimeout();

				callback(done, (response) => {
					cb(response, timeout ? startTimeout.bind(this, timeout) : undefined);
				});
			});
		};

		let expectedPrompt = interactions[0][0];
		let callback = interactions[0][2];
		for (let i = 1; i < interactions.length; i++) {
			const timeout = interactions[i][1];
			addTrigger(expectedPrompt, timeout, callback);
			expectedPrompt = interactions[i][0];
			callback = interactions[i][2];
		}
		// the last interaction completes without a timeout
		addTrigger(expectedPrompt, undefined, callback);

		serialPort.open((err) => {
			if (err) {
				return done.reject(err);
			}

			st.start();
			const next = () => {
				startTimeout(interactions[0][1]);
			};
			if (command) {
				serialPort.write(command);
				serialPort.drain(next);
			} else {
				next();
			}
		});

		when(done.promise).finally(() => {
			resetTimeout();
			serialPort.removeListener('close', serialClosedEarly);
			return when.promise((resolve) => {
				serialPort.close(resolve);
			});
		});

		return done.promise;
	}

	/* eslint-disable max-statements */
	serialWifiConfig(device, opts = {}) {
		if (!device) {
			return when.reject('No serial port available');
		}

		let isEnterprise = false;

		log.verbose('Attempting to configure Wi-Fi on ' + device.port);

		const serialPort = this.serialPort || new SerialPort(device.port, {
			baudRate: 9600,
			autoOpen: false
		});
		const parser = new SerialBatchParser({ timeout: 250 });
		serialPort.pipe(parser);

		const wifiDone = when.defer();
		serialPort.on('error', (err) => {
			wifiDone.reject(err);
		});

		const serialClosedEarly = () => {
			wifiDone.reject('Serial port closed early');
		};

		serialPort.on('close', serialClosedEarly);

		const startTimeout = (to) => {
			this._serialTimeout = setTimeout(() => {
				wifiDone.reject('Serial timed out');
			}, to);
		};

		const resetTimeout = () => {
			clearTimeout(this._serialTimeout);
			this._serialTimeout = null;
		};

		const st = new SerialTrigger(serialPort, parser);

		st.addTrigger('SSID:', (cb) => {
			resetTimeout();
			if (opts.network) {
				return cb(opts.network + '\n');
			}

			prompt([{
				type: 'input',
				name: 'ssid',
				message: 'SSID',
				validate: (input) => {
					if (!input || !input.trim()) {
						return 'Please enter a valid SSID';
					} else {
						return true;
					}
				},
				filter: (input) => {
					return input.trim();
				}
			}]).then((ans) => {
				cb(ans.ssid + '\n', startTimeout.bind(this, 5000));
			});
		});

		const parsesecurity = (ent, cb) => {
			resetTimeout();
			if (opts.security) {
				let security = 3;
				if (opts.security.indexOf('WPA2') >= 0 && opts.security.indexOf('802.1x') >= 0) {
					security = 5;
					isEnterprise = true;
				} else if (opts.security.indexOf('WPA') >= 0 && opts.security.indexOf('802.1x') >= 0) {
					security = 4;
					isEnterprise = true;
				} else if (opts.security.indexOf('WPA2') >= 0) {
					security = 3;
				} else if (opts.security.indexOf('WPA') >= 0) {
					security = 2;
				} else if (opts.security.indexOf('WEP') >= 0) {
					security = 1;
				} else if (opts.security.indexOf('NONE') >= 0) {
					security = 0;
				}

				return cb(security + '\n', startTimeout.bind(this, 10000));
			}

			const choices = [
				{ name: 'WPA2', value: 3 },
				{ name: 'WPA', value: 2 },
				{ name: 'WEP', value: 1 },
				{ name: 'Unsecured', value: 0 }
			];

			if (ent) {
				choices.push({ name: 'WPA Enterprise', value: 4 });
				choices.push({ name: 'WPA2 Enterprise', value: 5 });
			}

			prompt([{
				type: 'list',
				name: 'security',
				message: 'Security Type',
				choices: choices
			}]).then((ans) => {
				if (ans.security > 3) {
					isEnterprise = true;
				}
				cb(ans.security + '\n', startTimeout.bind(this, 10000));
			});
		};

		st.addTrigger('Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2:', parsesecurity.bind(null, false));
		st.addTrigger('Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2, 4=WPA Enterprise, 5=WPA2 Enterprise:', parsesecurity.bind(null, true));

		st.addTrigger('Security Cipher 1=AES, 2=TKIP, 3=AES+TKIP:', (cb) => {
			resetTimeout();
			if (opts.security !== undefined) {
				let cipherType = 1;
				if (opts.security.indexOf('AES') >= 0 && opts.security.indexOf('TKIP') >= 0) {
					cipherType = 3;
				} else if (opts.security.indexOf('TKIP') >= 0) {
					cipherType = 2;
				} else if (opts.security.indexOf('AES') >= 0) {
					cipherType = 1;
				}

				return cb(cipherType + '\n', startTimeout.bind(this, 5000));
			}

			prompt([{
				type: 'list',
				name: 'cipher',
				message: 'Cipher Type',
				choices: [
					{ name: 'AES+TKIP', value: 3 },
					{ name: 'TKIP', value: 2 },
					{ name: 'AES', value: 1 }
				]
			}]).then((ans) => {
				cb(ans.cipher + '\n', startTimeout.bind(this, 5000));
			});
		});

		st.addTrigger('EAP Type 0=PEAP/MSCHAPv2, 1=EAP-TLS:', (cb) => {
			resetTimeout();

			isEnterprise = true;

			if (opts.eap !== undefined) {
				let eapType = 0;
				if (opts.eap.toLowerCase().indexOf('peap') >= 0) {
					eapType = 0;
				} else if (opts.eap.toLowerCase().indexOf('tls')) {
					eapType = 1;
				}
				return cb(eapType + '\n', startTimeout.bind(this, 5000));
			}

			prompt([{
				type: 'list',
				name: 'eap',
				message: 'EAP Type',
				choices: [
					{ name: 'PEAP/MSCHAPv2', value: 0 },
					{ name: 'EAP-TLS', value: 1 }
				]
			}]).then((ans) => {
				cb(ans.eap + '\n', startTimeout.bind(this, 5000));
			});
		});

		st.addTrigger('Username:', (cb) => {
			resetTimeout();

			if (opts.username) {
				cb(opts.username + '\n', startTimeout.bind(this, 15000));
			} else {
				prompt([{
					type: 'input',
					name: 'username',
					message: 'Username',
					validate: (val) => {
						return !!val;
					}
				}]).then((ans) => {
					cb(ans.username + '\n', startTimeout.bind(this, 15000));
				});
			}
		});

		st.addTrigger('Outer identity (optional):', (cb) => {
			resetTimeout();

			if (opts.outer_identity) {
				cb(opts.outer_identity.trim + '\n', startTimeout.bind(this, 15000));
			} else {
				prompt([{
					type: 'input',
					name: 'outer_identity',
					message: 'Outer identity (optional)'
				}]).then((ans) => {
					cb(ans.outer_identity + '\n', startTimeout.bind(this, 15000));
				});
			}
		});

		st.addTrigger('Client certificate in PEM format:', (cb) => {
			resetTimeout();

			if (opts.client_certificate) {
				cb(opts.client_certificate.trim() + '\n\n', startTimeout.bind(this, 15000));
			} else {
				prompt([{
					type: 'editor',
					name: 'client_certificate',
					message: 'Client certificate in PEM format',
					validate: (val) => {
						return !!val;
					}
				}]).then((ans) => {
					cb(ans.client_certificate.trim() + '\n\n', startTimeout.bind(this, 15000));
				});
			}
		});

		st.addTrigger('Private key in PEM format:', (cb) => {
			resetTimeout();

			if (opts.private_key) {
				cb(opts.private_key.trim() + '\n\n', startTimeout.bind(this, 15000));
			} else {
				prompt([{
					type: 'editor',
					name: 'private_key',
					message: 'Private key in PEM format',
					validate: (val) => {
						return !!val;
					}
				}]).then((ans) => {
					cb(ans.private_key.trim() + '\n\n', startTimeout.bind(this, 15000));
				});
			}
		});

		st.addTrigger('Root CA in PEM format (optional):', (cb) => {
			resetTimeout();

			if (opts.root_ca) {
				cb(opts.root_ca.trim() + '\n\n', startTimeout.bind(this, 15000));
			} else {
				prompt([
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
				]).then((ans) => {
					if (ans.root_ca === undefined) {
						ans.root_ca = '';
					}
					cb(ans.root_ca.trim() + '\n\n', startTimeout.bind(this, 15000));
				});
			}
		});


		st.addTrigger('Password:', (cb) => {
			resetTimeout();
			// Skip password prompt as appropriate
			if (opts.password) {
				cb(opts.password + '\n', startTimeout.bind(this, 15000));

			} else {
				prompt([{
					type: 'input',
					name: 'password',
					message: !isEnterprise ? 'Wi-Fi Password' : 'Password',
					validate: (val) => {
						return !!val;
					}
				}]).then((ans) => {
					cb(ans.password + '\n', startTimeout.bind(this, 15000));
				});
			}
		});

		st.addTrigger('Spark <3 you!', () => {
			resetTimeout();
			wifiDone.resolve();
		});

		st.addTrigger('Particle <3 you!', () => {
			resetTimeout();
			wifiDone.resolve();
		});

		serialPort.open((err) => {
			if (err) {
				return wifiDone.reject(err);
			}

			st.start(true);
			serialPort.write('w');
			serialPort.drain();
		});

		when(wifiDone.promise).then(
			() => {
				console.log('Done! Your device should now restart.');
			}, (err) => {
			log.error('Something went wrong:', err);
		});

		when(wifiDone.promise).finally(() => {
			resetTimeout();
			serialPort.removeListener('close', serialClosedEarly);
			return when.promise((resolve) => {
				serialPort.close(resolve);
			});
		});

		return wifiDone.promise;
	}
	/* eslint-enable max-statements */

	/**
	 * Sends a command to the device and retrieves the response.
	 * @param device    The device to send the command to
	 * @param command   The command text
	 * @param timeout   How long in milliseconds to wait for a response
	 * @returns {Promise} to send the command.
	 * The serial port should not be open, and is closed after the command is sent.
	 * @private
	 */
	_issueSerialCommand(device, command, timeout) {
		if (!device) {
			return when.reject('no serial port provided');
		}
		const failDelay = timeout || 5000;

		let serialPort;
		return when.promise((resolve, reject) => {
			serialPort = this.serialPort || new SerialPort(device.port, {
				baudRate: 9600,
				autoOpen: false
			});
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
				if (err) {
					console.error('Serial err: ' + err);
					console.error('Serial problems, please reconnect the device.');
					reject('Serial problems, please reconnect the device.');
					return;
				}

				serialPort.write(command, (werr) => {
					if (werr) {
						reject(err);
					}
				});
			});
		}).finally(() => {
			if (serialPort) {
				serialPort.removeAllListeners('open');
				if (serialPort.isOpen) {
					return when.promise((resolve) => {
						serialPort.close(resolve);
					});
				}
			}
		});
	}

	getDeviceMacAddress(device) {
		if (!device) {
			return when.reject('getDeviceMacAddress - no serial port provided');
		}
		if (device.type === 'Core') {
			return when.reject('Unable to get MAC address of a Core');
		}

		return this._issueSerialCommand(device, 'm').then((data) => {
			const matches = data.match(/([0-9a-fA-F]{2}:){1,5}([0-9a-fA-F]{2})?/);
			if (matches) {
				let mac = matches[0].toLowerCase();
				// manufacturing firmware can sometimes not report the full MAC
				// lets try and fix it
				if (mac.length < 17) {
					const bytes = mac.split(':');
					while (bytes.length < 6) {
						bytes.unshift('00');
					}
					const usiMacs = [
						['6c', '0b', '84'],
						['44', '39', 'c4']
					];
					usiMacs.some((usimac) => {
						for (let i = usimac.length - 1; i >= 0; i--) {
							if (bytes[i] === usimac[i]) {
								mac = usimac.concat(bytes.slice(usimac.length)).join(':');
								return true;
							}
						}
					});
				}
				return mac;
			}
			throw new Error('Unable to find mac address in response');
		});
	}

	getSystemInformation(device) {
		if (!device) {
			return when.reject('getSystemInformation - no serial port provided');
		}

		return this._issueSerialCommand(device, 's');
	}

	askForDeviceID(device) {
		if (!device) {
			return when.reject('askForDeviceID - no serial port provided');
		}

		return this._issueSerialCommand(device, 'i').then((data) => {
			const matches = data.match(/Your (core|device) id is\s+(\w+)/);
			if (matches && matches.length === 3) {
				return matches[2];
			}
			const electronMatches = data.match(/\s+([a-fA-F0-9]{24})\s+/);
			if (electronMatches && electronMatches.length === 2) {
				const info = { id: electronMatches[1] };
				const imeiMatches = data.match(/IMEI: (\w+)/);
				if (imeiMatches) {
					info.imei = imeiMatches[1];
				}
				const iccidMatches = data.match(/ICCID: (\w+)/);
				if (iccidMatches) {
					info.iccid = iccidMatches[1];
				}

				return info;
			}
		});
	}

	askForSystemFirmwareVersion(device, timeout) {
		if (!device) {
			return when.reject('askForSystemFirmwareVersion - no serial port provided');
		}

		return this._issueSerialCommand(device, 'v', timeout).then((data) => {
			const matches = data.match(/system firmware version:\s+([\w.]+)/);
			if (matches && matches.length === 2) {
				return matches[1];
			}
		});
	}

	sendDoctorAntenna(device, antenna, timeout) {
		if (!device) {
			return when.reject('sendDoctorAntenna - no serial port provided');
		}

		const antennaValues = {
			'Internal': 'i',
			'External': 'e'
		};
		const command = 'a' + antennaValues[antenna];

		return this._issueSerialCommand(device, command, timeout).then((data) => {
			return data;
		});
	}

	sendDoctorIP(device, mode, ipAddresses, timeout) {
		if (!device) {
			return when.reject('sendDoctorIP - no serial port provided');
		}

		const modeValues = {
			'Dynamic IP': 'd',
			'Static IP': 's'
		};
		let command = 'i' + modeValues[mode];

		if (mode === 'Static IP') {
			const ipAddressValues = [ipAddresses.device_ip, ipAddresses.netmask, ipAddresses.gateway, ipAddresses.dns];
			const ipAddressesInt = _.map(ipAddressValues, this._ipToInteger);
			command += ipAddressesInt.join(' ') + '\n';
		}

		return this._issueSerialCommand(device, command, timeout).then((data) => {
			return data;
		});
	}

	sendDoctorSoftAPPrefix(device, prefix, timeout) {
		if (!device) {
			return when.reject('sendDoctorSoftAPPrefix - no serial port provided');
		}

		const command = 'p' + prefix + '\n';

		return this._issueSerialCommand(device, command, timeout).then((data) => {
			return data;
		});
	}

	sendDoctorClearEEPROM(device, timeout) {
		if (!device) {
			return when.reject('sendDoctorClearEEPROM - no serial port provided');
		}

		const command = 'e';

		return this._issueSerialCommand(device, command, timeout).then((data) => {
			return data;
		});
	}

	sendDoctorClearWiFi(device, timeout) {
		if (!device) {
			return when.reject('sendDoctorClearWiFi - no serial port provided');
		}

		const command = 'c';

		return this._issueSerialCommand(device, command, timeout).then((data) => {
			return data;
		});
	}

	sendDoctorListenMode(device, timeout) {
		if (!device) {
			return when.reject('sendDoctorListenMode - no serial port provided');
		}

		const command = 'l';

		return this._issueSerialCommand(device, command, timeout).then((data) => {
			return data;
		});
	}

	_ipToInteger(ip) {
		const parts = ip.split('.');
		if (parts.length !== 4) {
			return 0;
		}

		return (((parts[0] * 256) + parts[1]) * 256 + parts[2]) * 256 + parts[3];
	}

	_parsePort(devices, comPort) {
		if (!comPort) {
			//they didn't give us anything.
			if (devices.length === 1) {
				//we have exactly one device, use that.
				return devices[0];
			}
			//else - which one?
		} else {
			let portNum = parseInt(comPort);
			if (!isNaN(portNum)) {
				//they gave us a number
				if (portNum > 0) {
					portNum -= 1;
				}

				if (devices.length > portNum) {
					//we have it, use it.
					return devices[portNum];
				}
				//else - which one?
			} else {
				const matchedDevices = devices.filter((d) => {
					return d.port === comPort;
				});
				if (matchedDevices.length) {
					return matchedDevices[0];
				}

				//they gave us a string
				//doesn't matter if we have it or not, give it a try.
				return { port: comPort, type: '' };
			}
		}

		return null;
	}

	whatSerialPortDidYouMean(comPort, shouldPrompt, callback) {
		const promise = this.findDevices().then(devices => {
			const port = this._parsePort(devices, comPort);
			if (port) {
				return port;
			}

			if (!devices || devices.length === 0) {
				return;
			}

			return prompt([
				{
					name: 'port',
					type: 'list',
					message: 'Which device did you mean?',
					choices: devices.map((d) => {
						return {
							name: d.port + ' - ' + d.type,
							value: d
						};
					})
				}
			]).then((answers) => {
				return answers.port;
			});
		});

		if (typeof cb === 'function') {
			promise.then(port => callback(port));
		}

		return promise;
	}

	exit() {
		console.log();
		console.log(arrow, chalk.bold.white('Ok, bye! Don\'t forget `' +
			chalk.bold.cyan(cmd + ' help') + '` if you\'re stuck!',
			chalk.bold.magenta('<3'))
		);
		process.exit(0);
	}

	error(str, exit) {
		if (!str) {
			str = 'Unknown error';
		}
		str = 'serial: ' + str;

		console.log();
		console.log(chalk.bold.red('!'), chalk.bold.white(str));
		if (exit || exit === undefined) {
			process.exit(1);
		}
	}
}

module.exports = SerialCommand;
