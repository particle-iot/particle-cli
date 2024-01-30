const { spin } = require('../app/ui');
const { delay, asyncMapSeries, buildDeviceFilter } = require('../lib/utilities');
const { getDevice, formatDeviceInfo } = require('./device-util');
const { getUsbDevices, openUsbDevice, openUsbDeviceByIdOrName, TimeoutError, DeviceProtectionError } = require('./usb-util');
const { systemSupportsUdev, udevRulesInstalled, installUdevRules } = require('./udev');
const { platformForId, isKnownPlatformId } = require('../lib/platform');
const ParticleApi = require('./api');


module.exports = class UsbCommand {
	constructor(settings) {
		this._auth = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._auth }).api;
	}

	list(args) {
		const idsOnly = args['ids-only'];
		const excludeDfu = args['exclude-dfu'];
		const filter = args.params.filter;

		const filterFunc = buildDeviceFilter(filter);

		// Enumerate USB devices
		return getUsbDevices({ dfuMode: !excludeDfu })
			.then(usbDevices => {
				if (usbDevices.length === 0) {
					return [];
				}
				// Get device info
				return asyncMapSeries(usbDevices, (usbDevice) => {
					return openUsbDevice(usbDevice, { dfuMode: true })
						.then(() => {
							if (!idsOnly) {
								return getDevice({
									id: usbDevice.id,
									api: this._api,
									auth: this._auth,
									dontThrow: true
								});
							}
						})
						.then(device => {
							let info = [device, usbDevice.isInDfuMode];

							if (!usbDevice.isInDfuMode){
								info.push(
									usbDevice.getDeviceMode({ timeout: 10 * 1000 })
										.catch(error => {
											if (error instanceof TimeoutError) {
												return 'UNKNOWN';
											} else if (error instanceof DeviceProtectionError) {
												return 'PROTECTED';
											}
											throw error;
										})
								);
							}

							return Promise.all(info);
						})
						.then(([device, isInDfuMode, mode]) => {
							const { name, platform_id: platformID, connected } = device || {};
							const platform = isKnownPlatformId(usbDevice.platformId) ? platformForId(usbDevice.platformId).displayName :
								`Platform ${usbDevice.platformId}`;
							const type = [platform];

							if (isInDfuMode){
								type.push('DFU');
							}

							if (mode && (mode !== 'UNKNOWN' && mode !== 'NORMAL')){
								type.push(mode);
							}

							return {
								id: usbDevice.id,
								name: name || '',
								type: `${type.join(', ')}`,
								platform_id: platformID || usbDevice.platformId,
								connected: !!connected
							};
						})
						.finally(() => usbDevice.close());
				});
			})
			.then(devices => {
				if (idsOnly) {
					devices.forEach(device => console.log(device.id));
				} else {
					if (devices.length === 0) {
						console.log('No devices found.');
					} else {
						devices = devices.sort((a, b) => a.name.localeCompare(b.name)); // Sort devices by name

						if (filter) {
							devices = devices.filter(filterFunc);
						}
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
		}, { dfuMode: true })
			.then(() => {
				console.log('Done.');
			});
	}

	setSetupDone(args) {
		const done = !args.reset;
		return this._forEachUsbDevice(args, usbDevice => {
			if (usbDevice.isGen3Device) {
				return usbDevice.setSetupDone(done)
					.then(() => {
						if (done) {
							return usbDevice.leaveListeningMode();
						}
						return usbDevice.enterListeningMode();
					});
			}
		})
			.then(() => {
				console.log('Done.');
			});
	}

	configure() {
		if (!systemSupportsUdev()) {
			console.log('The system does not require configuration.');
			return Promise.resolve();
		}
		if (udevRulesInstalled()) {
			console.log('The system is already configured.');
			return Promise.resolve();
		}
		return installUdevRules()
			.then(() => console.log('Done.'));
	}

	cloudStatus(args, started = Date.now()){
		const { until, timeout, params: { device } } = args;

		if (Date.now() - (started + timeout) > 0){
			throw new Error('timed-out waiting for status...');
		}

		const deviceMgr = {
			_: null,
			set(usbDevice){
				this._ = usbDevice || null;
				return this;
			},
			close(){
				const { _: usbDevice } = this;
				return usbDevice ? usbDevice.close() : Promise.resolve();
			},
			status(){
				const { _: usbDevice } = this;
				let getStatus = usbDevice
					? usbDevice.getCloudConnectionStatus()
					: Promise.resolve('unknown');

				return getStatus.then(status => status.toLowerCase());
			}
		};

		const queryDevice = openUsbDeviceByIdOrName(device, this._api, this._auth)
			.then(usbDevice => deviceMgr.set(usbDevice).status());

		return spin(queryDevice, 'Querying device...')
			.then(status => {
				if (until && until !== status){
					throw new Error(`Unexpected status: ${status}`);
				}
				console.log(status);
			})
			.catch(error => {
				if (until){
					return deviceMgr.close()
						.then(() => delay(1000))
						.then(() => this.cloudStatus(args, started));
				}
				throw error;
			})
			.finally(() => deviceMgr.close());
	}

	_forEachUsbDevice(args, func, { dfuMode = false } = {}){
		const msg = 'Getting device information...';
		const operation = this._openUsbDevices(args, { dfuMode });
		let lastError = null;
		return spin(operation, msg)
			.then(usbDevices => {
				const p = usbDevices.map(usbDevice => {
					return Promise.resolve()
						.then(() => func(usbDevice))
						.catch(e => lastError = e)
						.finally(() => usbDevice.close());
				});
				return spin(Promise.all(p), 'Sending a command to the device...');
			})
			.then(() => {
				if (lastError){
					throw lastError;
				}
			});
	}

	_openUsbDevices(args, { dfuMode = false } = {}){
		const deviceIds = args.params.devices;
		return Promise.resolve()
			.then(() => {
				if (args.all){
					return getUsbDevices({ dfuMode: true })
						.then(usbDevices => {
							return asyncMapSeries(usbDevices, (usbDevice) => {
								return openUsbDevice(usbDevice, { dfuMode })
									.then(() => usbDevice);
							});
						});
				}

				if (deviceIds.length === 0){
					return getUsbDevices({ dfuMode: true })
						.then(usbDevices => {
							if (usbDevices.length === 0){
								throw new Error('No devices found');
							}
							if (usbDevices.length > 1){
								throw new Error('Found multiple devices. Please specify the ID or name of one of them');
							}
							const usbDevice = usbDevices[0];
							return openUsbDevice(usbDevice, { dfuMode })
								.then(() => [usbDevice]);
						});
				}

				return asyncMapSeries(deviceIds, (id) => {
					return openUsbDeviceByIdOrName(id, this._api, this._auth, { dfuMode })
						.then(usbDevice => usbDevice);
				});
			});
	}
};

