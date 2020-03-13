const ParticleApi = require('./api');
const { asyncMapSeries } = require('../lib/utilities');
const { getDevice, formatDeviceInfo } = require('./device-util');
const { openUsbDeviceById } = require('./usb-util');
const { platformsById } = require('./constants');
const { prompt, spin } = require('../app/ui');


module.exports = class MeshCommand {
	constructor(settings) {
		this._auth = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._auth }).api;
	}

	create(args) {
		let device = null;
		let usbDevice = null;
		let networkPassword = null;

		return this._getDevice(args.params.device)
			.then(d => {
				device = d;
				// Open the device
				return this._openUsbDeviceById(device.id, args.params.device);
			})
			.then(d => {
				usbDevice = d;

				if (!device.network) {
					return;
				}

				// Remove the device from its current network
				let p = Promise.resolve();

				if (!args.yes) {
					const question = {
						name: 'remove',
						type: 'confirm',
						message: 'This device is already a member of another network. Do you want to remove it from that network and proceed?',
						default: false
					};

					p = p.then(() => prompt(question))
						.then(r => {
							if (!r.remove) {
								throw new Error('Cancelled');
							}
						});
				}
				return p.then(() => this._removeDeviceFromNetwork(usbDevice));
			})
			.then(() => {
				if (args.password) {
					return args.password;
				}

				const questions = [
					{
						name: 'password',
						type: 'password',
						message: 'Enter a password for the new network'
					},
					{
						name: 'confirm',
						type: 'password',
						message: 'Confirm the password'
					}
				];

				return prompt(questions)
					.then(r => {
						if (r.password !== r.confirm) {
							throw new Error('The entered passwords do not match');
						}
						return r.password;
					});
			})
			.then(password => {
				networkPassword = password;

				if (usbDevice.isCellularDevice) {
					const p = usbDevice.getIccid();
					return spin(p, 'Getting the ICCID...');
				}
			})
			.then(iccid => {
				const spec = {
					name: args.params.network_name,
					deviceId: device.id,
					auth: this._auth,
					iccid
				};

				const p = this._api.createMeshNetwork(spec)
					.then(r => r.body.network.id);

				return spin(p, 'Registering the network with the cloud...');
			})
			.then(networkId => {
				const spec = {
					id: networkId,
					name: args.params.network_name,
					password: networkPassword,
					channel: args.channel
				};

				return spin(usbDevice.createMeshNetwork(spec), 'Creating the network...');
			})
			.then(() => {
				return usbDevice.leaveListeningMode();
			})
			.then(() => {
				console.log('Done! The device will be registered in the network once it is connected to the cloud.');
			})
			.finally(() => {
				if (usbDevice) {
					return usbDevice.close();
				}
			});
	}

	add(args) {
		let joinerDevice = null;
		let assistDevice = null;
		let joinerUsbDevice = null;
		let assistUsbDevice = null;
		let networkId = null;
		// Get the assisting device
		return this._getDevice(args.params.assisting_device)
			.then(d => {
				assistDevice = d;

				if (!assistDevice.network) {
					throw new Error('The assisting device is not a member of any mesh network');
				}

				networkId = assistDevice.network.id;
				// Open the assisting device
				return this._openUsbDeviceById(assistDevice.id, args.params.assisting_device);
			})
			.then(d => {
				assistUsbDevice = d;
				// Get the joiner device. Do not fail if the device is not claimed
				return this._getDevice(args.params.new_device, true);
			})
			.then(d => {
				joinerDevice = d; // Can be null
				// Open the joiner device
				let idOrName = args.params.new_device;

				if (joinerDevice) {
					idOrName = joinerDevice.id; // Saves an API call
				}

				return this._openUsbDeviceById(idOrName, args.params.new_device);
			})
			.then(d => {
				joinerUsbDevice = d;
				// Check if the joiner device is already a member of some network
				let p = Promise.resolve();

				if (joinerDevice && joinerDevice.network) {
					if (joinerDevice.network.id === networkId) {
						console.log('The device is already a member of the network.');
						return p; // Done
					}

					if (!args.yes) {
						p = p.then(() => prompt({
							name: 'remove',
							type: 'confirm',
							message: 'The device is already a member of another network. Do you want to remove it from that network and proceed?',
							default: false
						}))
							.then(r => {
								if (!r.remove) {
									throw new Error('Cancelled');
								}
							});
					}

					p = p.then(() => this._removeDeviceFromNetwork(joinerUsbDevice));
				}
				return p.then(() => {
					if (args.password) {
						return args.password;
					}

					const question = {
						name: 'password',
						type: 'password',
						message: 'Enter the network password'
					};

					return prompt(question)
						.then(r => r.password);
				})
					.then(password => {
						// Start the commissioner role
						const p = assistUsbDevice.meshAuth(password).then(() => assistUsbDevice.startCommissioner());
						return spin(p, 'Preparing the assisting device...');
					})
					.then(() => {
						let p = Promise.resolve();

						if (!joinerDevice) {
							// The cloud will refuse to add an unclaimed device to a network, if the device is
							// already a member of some other network
							p = p.then(() => this._api.removeMeshNetworkDevice({ deviceId: joinerUsbDevice.id, auth: this._auth }));
						}

						// Register the joiner device with the cloud
						p = p.then(() => this._api.addMeshNetworkDevice({ networkId, deviceId: joinerUsbDevice.id, auth: this._auth }));

						return spin(p, 'Registering the device with the cloud...');
					})
					.then(() => {
						// Add the joiner device to the network
						const p = joinerUsbDevice.joinMeshNetwork(assistUsbDevice).then(() => assistUsbDevice.stopCommissioner());
						return spin(p, 'Adding the device to the network...');
					})
					.then(() => {
						// Claim the joiner device if necessary
						// FIXME: Normally, this should be done via `particle setup`, but it doesn't support mesh devices yet
						if (!joinerDevice) {
							const p = this._api.getClaimCode({ auth: this._auth })
								.then(r => {
									return joinerUsbDevice.setClaimCode(r.body.claim_code);
								})
								.then(() => {
									// Set the setup done flag
									return joinerUsbDevice.setSetupDone();
								});

							return spin(p, 'Claiming the device to your account...');
						}
					})
					.then(() => {
						// Leave the listening mode
						return joinerUsbDevice.leaveListeningMode();
					})
					.then(() => {
						console.log('Done! The device should now connect to the cloud.');
					});
			})
			.finally(() => {
				if (joinerUsbDevice) {
					return joinerUsbDevice.close();
				}
			})
			.finally(() => {
				if (assistUsbDevice) {
					return assistUsbDevice.close();
				}
			});
	}

	remove(args) {
		let device = null;
		let usbDevice = null;
		return this._getDevice(args.params.device)
			.then(d => {
				device = d;

				let p = Promise.resolve();

				if (!device.network) {
					console.log('This device is not a member of any mesh network.');
					return p; // Done
				}

				if (!args.yes) {
					const question = {
						name: 'remove',
						type: 'confirm',
						message: 'Are you sure you want to remove this device from the network?',
						default: false
					};

					p = p.then(() => prompt(question))
						.then(r => {
							if (!r.remove) {
								throw new Error('Cancelled');
							}
						});
				}
				return p.then(() => this._openUsbDeviceById(device.id, args.params.device))
					.then(d => {
						usbDevice = d;
						return this._removeDeviceFromNetwork(usbDevice);
					})
					.then(() => {
						console.log('Done.');
					});
			})
			.finally(() => {
				if (usbDevice) {
					return usbDevice.close();
				}
			});
	}

	list(args) {
		return Promise.resolve()
			.then(() => {
				if (args.params.network) {
					// Get the network
					return this._getNetwork(args.params.network)
						.then(network => [network]);
				}

				// Get all networks
				const p = this._api.listMeshNetworks({ auth: this._auth })
					.then(r => {
						return r.body.sort((a, b) => a.name.localeCompare(b.name)); // Sort networks by name
					});

				return spin(p, 'Retrieving networks...');
			})
			.then(networks => {
				let p = Promise.resolve();

				if (networks.length === 0) {
					console.log('No networks found.');
					return p; // Done
				}

				const listDevices = !args['networks-only'];

				if (listDevices) {
					p = p.then(() => asyncMapSeries(networks, (network) => {
						const spec = { networkId: network.id, auth: this._auth };
						return this._api.listMeshNetworkDevices(spec)
							.then(r => {
								network.devices = r.body.sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort devices by name
							});
					}));

					p = spin(p, 'Retrieving network devices...');
				}

				return p.then(() => {
					networks.forEach(network => {
						console.log(network.name);
						if (listDevices && network.devices.length > 0) {
							console.log('  devices:');
							network.devices.forEach(device => {
								const type = platformsById[device.platform_id];
								console.log(`    ${formatDeviceInfo({ id: device.id, name: device.name, type })}`);
							});
						}
					});
				});
			});
	}

	info(args) {
		let usbDevice = null;
		// Open the device
		return this._openUsbDeviceById(args.params.device)
			.then(d => {
				usbDevice = d;
				// Get the network info
				return usbDevice.getMeshNetworkInfo();
			})
			.then(network => {
				if (network) {
					console.log(`This device is a member of ${network.name}.`);
				} else {
					console.log('This device is not a member of any mesh network.');
				}
			})
			.finally(() => {
				if (usbDevice) {
					return usbDevice.close();
				}
			});
	}

	scan(args) {
		let usbDevice = null;
		// Open the device
		return this._openUsbDeviceById(args.params.device)
			.then(d => {
				usbDevice = d;
				// Scan for networks
				const p = usbDevice.scanMeshNetworks();
				return spin(p, 'Scanning for networks...');
			})
			.then(networks => {
				if (networks.length === 0) {
					console.log('No networks found.');
				} else {
					// Device OS versions prior to 1.2.0 might report the same network multiple times:
					// https://github.com/particle-iot/device-os/pull/1760. As a workaround, we're filtering
					// out duplicate network entries at the client side as well
					networks = networks.filter((n1, i1) => {
						const i2 = networks.findIndex(n2 => n1.name === n2.name && n1.panId === n2.panId && n1.extPanId === n2.extPanId);
						return i1 === i2;
					});
					networks = networks.sort((a, b) => a.name.localeCompare(b.name)); // Sort networks by name
					networks.forEach(network => console.log(network.name));
				}
			})
			.finally(() => {
				if (usbDevice) {
					return usbDevice.close();
				}
			});
	}

	_removeDeviceFromNetwork(usbDevice) {
		const p = this._api.removeMeshNetworkDevice({ deviceId: usbDevice.id, auth: this._auth });

		return spin(p, 'Removing the device from the network...')
			.then(() => {
				return spin(usbDevice.leaveMeshNetwork(), 'Clearing the network credentials...');
			});
	}

	_openUsbDeviceById(deviceId, displayName = null) {
		return openUsbDeviceById({ id: deviceId, displayName, api: this._api, auth: this._auth })
			.then(usbDevice => {
				if (!usbDevice.isMeshDevice) {
					return usbDevice.close().then(() => {
						throw new Error('The device does not support mesh networking');
					});
				}
				return usbDevice;
			});
	}

	_getDevice(deviceId, dontThrow = false) {
		return getDevice({ id: deviceId, api: this._api, auth: this._auth, dontThrow });
	}

	_getNetwork(networkId) {
		const p = Promise.resolve()
			.then(() => this._api.getMeshNetwork({ networkId, auth: this._auth }))
			.then(r => {
				return r.body;
			})
			.catch(e => {
				if (e.statusCode === 404) {
					throw new Error(`Network not found: ${networkId}`);
				}
				throw e;
			});

		return spin(p, 'Getting network information...');
	}
};

