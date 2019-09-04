const _ = require('lodash');
const chalk = require('chalk');
const VError = require('verror');
const prompt = require('inquirer').prompt;
const { delay } = require('../lib/utilities');
const ApiClient = require('../lib/api-client');
const dfu = require('../lib/dfu');

function EarlyReturnError(){
}

function SkipStepError(){
}

const deviceTimeout = 3000;
const serialTimeout = 3000;


module.exports = class DoctorCommand {
	constructor(){
		this._commands = {};
	}

	deviceDoctor(){
		this._showDoctorWelcome();

		return Promise.resolve()
			.then(this._setupApi.bind(this))
			.then(this._findDevice.bind(this))
			.then(this._nameDevice.bind(this))
			.then(this._updateSystemFirmware.bind(this))
			.then(this._updateCC3000.bind(this))
			.then(this._flashDoctor.bind(this))
			.then(this._selectAntenna.bind(this))
			.then(this._selectIP.bind(this))
			.then(this._resetSoftAPPrefix.bind(this))
			.then(this._clearEEPROM.bind(this))
			.then(this._setupWiFi.bind(this))
			.then(this._resetKeys.bind(this))
			.then(this._flashTinker.bind(this))
			.then(this._showDoctorGoodbye.bind(this))
			.catch(this._showDoctorError.bind(this));
	}

	command(name, options = { params: {} }){
		const Command = require(`./${name}`);
		return new Command(options);
	}

	_showDoctorWelcome(){
		console.log(chalk.bold.white('The Device Doctor will put your device back into a healthy state'));
		console.log('It will:');
		_.map([
			'Upgrade system firmware',
			'Flash the default Tinker app',
			'Reset the device and server keys',
			'Clear the Wi-Fi settings',
		], (line) => {
			console.log('  - ' + line);
		});
	}

	_setupApi(){
		this.api = new ApiClient();
		if (!this.api.ready()){
			throw new EarlyReturnError();
		}
	}

	_findDevice(){
		// Try to find a "normal" mode device through the serial port
		return this.command('serial')
			.findDevices()
			.then(devices => {
				if (devices.length === 0){
					// Try to find a "DFU" mode device through dfu-util
					return dfu.listDFUDevices();
				} else {
					return devices;
				}
			})
			.then((devices) => {
				this.device = devices && devices[0];
				return devices;
			});
	}

	_nameDevice(devices){
		if (devices.length === 0){
			console.log('');
			console.log(chalk.cyan('>'), 'Connect a Particle device to a USB port and run the command again.');
			throw new EarlyReturnError();
		}

		if (devices.length > 1){
			console.log('');
			console.log(chalk.cyan('!'), 'You have ' + devices.length + ' devices connected to USB ports.');
			console.log(chalk.cyan('!'), 'To avoid confusion, disconnect all but the one device and run the command again.');
			throw new EarlyReturnError();
		}

		const deviceName = this.device.type || 'Device';
		console.log('');
		console.log('The Doctor will operate on your ' + deviceName + ' connected over USB');
		console.log("You'll be asked to put your device in DFU mode several times to reset different settings.");
	}

	_enterDfuMode(){
		console.log('Put the device in ' + chalk.bold.yellow('DFU mode'));
		console.log('Tap ' + chalk.bold.cyan('RESET/RST') + ' while holding ' + chalk.bold.cyan('MODE/SETUP') +
			' until the device blinks ' + chalk.bold.yellow('yellow.'));
		return this._promptReady();
	}

	_promptReady(){
		return prompt([{
			type: 'list',
			name: 'choice',
			message: 'Select Continue when ready',
			choices: ['Continue', 'Skip step', 'Exit']
		}]).then((ans) => {
			switch (ans.choice){
				case 'Skip step':
					throw new SkipStepError();
				case 'Exit':
					throw new EarlyReturnError();
				default:
					return;
			}
		});
	}

	_catchSkipStep(e){
		if (e instanceof SkipStepError){
			return;
		} else {
			throw e;
		}
	}

	_displayStepTitle(title){
		console.log(chalk.bold.white('\n' + title + '\n'));
	}

	_updateSystemFirmware(){
		if (!this._deviceHasFeature('system-firmware')){
			return;
		}

		this._displayStepTitle('Updating system firmware');

		return this._enterDfuMode()
			.then(() => {
				return this.command('update').updateDevice();
			})
			.catch(this._catchSkipStep);
	}

	_updateCC3000(){
		if (!this._deviceHasFeature('cc3000')){
			return;
		}

		this._displayStepTitle('Updating CC3000 firmware');

		return this._enterDfuMode()
			.then(() => {
				return this.command('flash').flashDfu({ binary: 'cc3000' });
			})
			.then(() => {
				console.log('Applying update...');
				console.log('Wait until the device stops blinking ' + chalk.bold.magenta('magenta') + ' and starts blinking ' + chalk.bold.yellow('yellow'));

				return prompt([{
					type: 'list',
					name: 'choice',
					message: 'Press ENTER when ready',
					choices: ['Continue']
				}]);
			})
			.catch(this._catchSkipStep);
	}

	_flashDoctor(){
		this._displayStepTitle('Flashing the Device Doctor app');
		console.log('This app allows changing more settings on your device\n');
		return this._enterDfuMode()
			.then(() => {
				// See the source code of the doctor app in binaries/doctor.ino
				return this.command('flash').flashDfu({ binary: 'doctor' });
			})
			.then(() => {
				return this._waitForSerialDevice(deviceTimeout);
			})
			.then((device) => {
				if (!device){
					throw new Error('Could not find serial device. Ensure the Device Doctor app was flashed');
				}
			})
			.catch(this._catchSkipStep);
	}

	_selectAntenna(){
		if (!this._deviceHasFeature('antenna-selection')){
			return;
		}

		this._displayStepTitle('Select antenna');
		const question = {
			type: 'list',
			name: 'choice',
			message: 'Select the antenna to use to connect to Wi-Fi',
			choices: ['Internal', 'External', 'Skip step', 'Exit']
		};

		return prompt([question])
			.then((ans) => {
				switch (ans.choice){
					case 'Skip step':
						throw new SkipStepError();
					case 'Exit':
						throw new EarlyReturnError();
					default:
						return ans.choice;
				}
			})
			.then((antenna) => {
				return this.command('serial').sendDoctorAntenna(this.device, antenna, serialTimeout);
			})
			.then((message) => {
				console.log(message);
			})
			.catch(this._catchSkipStep);
	}

	_selectIP(){
		if (!this._deviceHasFeature('wifi')){
			return;
		}

		this._displayStepTitle('Configure IP address');
		const question = {
			type: 'list',
			name: 'choice',
			message: 'Select how the device will be assigned an IP address',
			choices: ['Dynamic IP', 'Static IP', 'Skip step', 'Exit']
		};

		let mode;
		return prompt([question])
			.then((ans) => {
				switch (ans.choice){
					case 'Skip step':
						throw new SkipStepError();
					case 'Exit':
						throw new EarlyReturnError();
					default:
						mode = ans.choice;
				}
			})
			.then(() => {
				if (mode === 'Static IP'){
					return this._promptIPAddresses({
						device_ip: 'Device IP',
						netmask: 'Netmask',
						gateway: 'Gateway',
						dns: 'DNS'
					});
				}
			})
			.then((ipAddresses) => {
				return this.command('serial').sendDoctorIP(this.device, mode, ipAddresses, serialTimeout);
			})
			.then((message) => {
				console.log(message);
			})
			.catch(this._catchSkipStep);
	}

	_promptIPAddresses(ips){
		return prompt(_.map(ips, (label, key) => {
			return {
				type: 'input',
				name: key,
				message: label,
				validate(val){
					const parts = val.split('.');
					const allNumbers = _.every(parts, (n) => {
						return (+n).toString() === n;
					});
					return parts.length === 4 && allNumbers;
				}
			};
		})).then((ans) => {
			return _.mapValues(ips, (label, key) => {
				return ans[key];
			});
		});
	}

	_resetSoftAPPrefix(){
		if (!this._deviceHasFeature('softap')){
			return;
		}

		this._displayStepTitle('Reset Wi-Fi hotspot name in listening mode');

		return this._promptReady()
			.then(() => {
				return this.command('serial').sendDoctorSoftAPPrefix(this.device, '', serialTimeout);
			})
			.then((message) => {
				console.log(message);
			})
			.catch(this._catchSkipStep);
	}

	_clearEEPROM(){
		this._displayStepTitle('Clear all data in EEPROM storage');

		return this._promptReady()
			.then(() => {
				return this.command('serial').sendDoctorClearEEPROM(this.device, serialTimeout);
			})
			.then((message) => {
				console.log(message);
			})
			.catch(this._catchSkipStep);
	}

	_flashTinker(){
		this._displayStepTitle('Flashing the default Particle Tinker app');

		return this._enterDfuMode()
			.then(() => {
				return this.command('flash').flashDfu({ binary: 'tinker' });
			})
			.catch(this._catchSkipStep);
	}

	_resetKeys(){
		this._displayStepTitle('Resetting server and device keys');

		// do this again to refresh the device data with latest firmware
		return this._waitForSerialDevice(deviceTimeout)
			.then(() => this._verifyDeviceOwnership())
			.then(() => this._enterDfuMode())
			.then(() => {
				return this.command('keys').writeServerPublicKey();
				// keys servers doesn't cause the device to reset so it is still in DFU mode
			})
			.then(() => {
				if (!this.device || !this.device.deviceId){
					console.log(chalk.red('!'), 'Skipping device key because it does not report its device ID over USB');
					return;
				}
				return this.command('keys').keyDoctor(this.device.deviceId);
			})
			.catch(this._catchSkipStep);
	}

	_waitForSerialDevice(timeout){
		let timeoutReached = false;

		delay(timeout).then(() => {
			timeoutReached = true;
		});

		const tryFindDevice = () => {
			return this._findDevice().then(() => {
				if (this.device && this.device.port){
					return this.device;
				} else if (timeoutReached){
					return null;
				} else {
					return delay(250).then(tryFindDevice);
				}
			});
		};

		return tryFindDevice();
	}

	_verifyDeviceOwnership(){
		return Promise.resolve()
			.then(() => {
				if (!this.device || !this.device.deviceId){
					return false;
				}

				return this.api.getAttributes(this.device.deviceId)
					.then((attributes) => attributes.error !== 'Permission Denied')
					.catch(() => false);
			})
			.then((ownsDevice) => {
				if (ownsDevice){
					return;
				}
				console.log(chalk.red('!'), 'This device is not claimed to your Particle account.');
				console.log(chalk.red('!'), 'Resetting keys for a device you do not own may permanently prevent it from connecting to the Particle cloud.');
				return prompt([{
					type: 'confirm',
					name: 'choice',
					message: 'Skip resetting keys?',
					default: true
				}])
					.then((ans) => {
						if (ans.choice){
							throw new SkipStepError();
						}
					});
			});
	}

	_setupWiFi(){
		if (!this._deviceHasFeature('wifi')){
			return;
		}

		this._displayStepTitle('Clearing and setting up Wi-Fi settings');

		return this._promptReady()
			.then(() => {
				return this.command('serial').sendDoctorClearWiFi(this.device, serialTimeout);
			})
			.then((message) => {
				console.log(message);
			})
			.then(() => {
				return this.command('serial').sendDoctorListenMode(this.device, serialTimeout);
			})
			.then((message) => {
				console.log(message);
			})
			.then(() => {
				return this.command('serial').promptWifiScan(this.device);
			})
			.catch(this._catchSkipStep);
	}

	_deviceHasFeature(feature){
		const features = (this.device && this.device.specs && this.device.specs.features) || [];
		return _.includes(features, feature);
	}

	_showDoctorGoodbye(){
		this._displayStepTitle('The Doctor has restored your device!');
		console.log(chalk.cyan('>'), "Please visit our community forums if your device still can't connect to the Particle cloud");
		console.log(chalk.bold.white('https://community.particle.io/'));
	}

	_showDoctorError(e){
		if (e instanceof EarlyReturnError){
			return;
		}

		const msg = (e && e.message) || '';
		console.log(`The Doctor didn't complete successfully. ${msg}`);

		if (global.verboseLevel > 1){
			console.log(VError.fullStack(e));
		}
		console.log(chalk.cyan('>'), 'Please visit our community forums for help with this error:');
		console.log(chalk.bold.white('https://community.particle.io/'));
	}
};

