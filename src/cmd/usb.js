const ParticleApi = require('./api').default;
const { getDevice, formatDeviceInfo } = require('./device-util');
const { getUsbDevices, openUsbDevice, openUsbDeviceById, systemSupportsUdev, udevRulesInstalled,
		installUdevRules } = require('./usb-util');
const { spin } = require('../app/ui');

const when = require('when');
const sequence = require('when/sequence');

module.exports = class UsbCommand {
	constructor(settings) {
		this._auth = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._auth }).api;
	}

	list(args) {
		const idsOnly = args['ids-only'];
		const excludeDfu = args['exclude-dfu'];
		// Enumerate USB devices
		return getUsbDevices({ dfuMode: !excludeDfu }).then(usbDevices => {
			if (usbDevices.length === 0) {
				return [];
			}
			// Get device info
			return sequence(usbDevices.map(usbDevice => () => {
				return openUsbDevice(usbDevice, { dfuMode: true }).then(() => {
					if (!idsOnly) {
						return getDevice({ id: usbDevice.id, api: this._api, auth: this._auth, dontThrow: true });
					}
				})
				.then(device => ({
					id: usbDevice.id,
					type: usbDevice.isInDfuMode ? `${usbDevice.type}, DFU` : usbDevice.type,
					name: (device && device.name) ? device.name : ''
				}))
				.finally(() => usbDevice.close());
			}));
		})
		.then(devices => {
			if (idsOnly) {
				devices.forEach(device => console.log(device.id));
			} else {
				if (devices.length === 0) {
					console.log('No devices found.');
				} else {
					devices = devices.sort((a, b) => a.name.localeCompare(b.name)); // Sort devices by name
					devices.forEach(device => {
						console.log(formatDeviceInfo(device));
					});
				}
			}
		});
	}

	startListening(args) {
		return this._forEachUsbDevice(args, usbDevice => {
			return usbDevice.enterListeningMode();
		})
		.then(() => {
			console.log('Done.');
		});
	}

	stopListening(args) {
		return this._forEachUsbDevice(args, usbDevice => {
			return usbDevice.leaveListeningMode();
		})
		.then(() => {
			console.log('Done.');
		});
	}

	safeMode(args) {
		return this._forEachUsbDevice(args, usbDevice => {
			return usbDevice.enterSafeMode();
		})
		.then(() => {
			console.log('Done.');
		});
	}

	dfu(args) {
		return this._forEachUsbDevice(args, usbDevice => {
			if (!usbDevice.isInDfuMode) {
				return usbDevice.enterDfuMode();
			}
		}, { dfuMode: true })
		.then(() => {
			console.log('Done.');
		});
	}

	reset(args) {
		return this._forEachUsbDevice(args, usbDevice => {
			return usbDevice.reset();
		})
		.then(() => {
			console.log('Done.');
		});
	}

	configure(args) {
		if (!systemSupportsUdev()) {
			console.log('The system does not require configuration.');
			return when.resolve();
		}
		if (udevRulesInstalled()) {
			console.log('The system is already configured.');
			return when.resolve();
		}
		return installUdevRules()
			.then(() => console.log('Done.'));
	}

	_forEachUsbDevice(args, func, { dfuMode = false } = {}) {
		let lastError = null;
		return when.resolve().then(() => {
			if (args.all) {
				// Get all devices
				return getUsbDevices();
			}
			if (args.one) {
				// Get a single device. Fail if multiple devices are detected
				return getUsbDevices().then(usbDevices => {
					if (usbDevices.length === 0) {
						throw new Error('No devices found');
					}
					if (usbDevices.length > 1) {
						throw new Error('Found multiple devices. Please specify the ID or name of one of them');
					}
					return [usbDevices[0]];
				});
			}
			// Open specific devices
			const deviceIds = args.params.devices;
			if (!deviceIds || deviceIds.length === 0) {
				throw new Error('Device ID or name is missing');
			}
			const usbDevices = [];
			return sequence(deviceIds.map(id => () => {
				return openUsbDeviceById({ id, dfuMode, api: this._api, auth: this._auth })
					.then(usbDevice => usbDevices.push(usbDevice))
					.catch(e => lastError = e); // Skip the device and remember the error
			}))
			.then(() => usbDevices);
		})
		.then(usbDevices => {
			// Send the command to each device
			const p = usbDevices.map(usbDevice => {
				// The device is not necessarily open at this point
				let p = when.resolve();
				if (!usbDevice.isOpen) {
					p = p.then(() => openUsbDevice(usbDevice, { dfuMode }));
				}
				return p.then(() => func(usbDevice))
					.catch(e => lastError = e)
					.finally(() => usbDevice.close());
			});
			return spin(when.all(p), 'Sending a command to the device...');
		})
		.then(() => {
			if (lastError) {
				throw lastError;
			}
		});
	}
};
