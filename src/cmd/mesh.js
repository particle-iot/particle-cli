const ParticleApi = require('./api');
const { getDevice, formatDeviceInfo } = require('./device-util');
const { openUsbDeviceById } = require('./usb-util');
const { platformsById } = require('./constants');
const { prompt, spin } = require('../app/ui');

const when = require('when');
const sequence = require('when/sequence');

module.exports = class MeshCommand {
	constructor(settings) {
		this._auth = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._auth }).api;
	}

	create(args) {
		let device = null;
		let usbDevice = null;
		let networkPassword = null;
		return this._getDevice(args.params.device).then(d => {
			device = d;
			// Open the device
			return this._openUsbDeviceById(device.id, args.params.device);
		})
			.then(d => {
				usbDevice = d;
				// Check if the device is already a member of some network
				return this._getDeviceNetworkId(device);
			})
			.then(networkId => {
				if (!networkId) {
					return;
				}
				// Remove the device from its current network
				let p = when.resolve();
				if (!args.yes) {
					p = p.then(() => prompt({
						name: 'remove',
						type: 'confirm',
						message: 'This device is already a member of another network. Do you want to remove it from that network and proceed?',
						default: false
					}))
						.then(r => {
							if (!r.remove) {
								throw new Error('Cancelled');
							}
						});
				}
				return p.then(() => this._removeDevice(usbDevice, networkId));
			})
			.then(() => {
			// Get a password for the new network
				if (args.password) {
					return args.password;
				}
				return prompt([{
					name: 'password',
					type: 'password',
					message: 'Enter a password for the new network'
				}, {
					name: 'confirm',
					type: 'password',
					message: 'Confirm the password'
				}])
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
				// Get the ICCID of the active SIM card
					const p = usbDevice.getIccid();
					return spin(p, 'Getting the ICCID...');
				}
			})
			.then(iccid => {
			// Register the network with the cloud and get the network ID
				const p = this._api.createMeshNetwork({ name: args.params.network_name, deviceId: device.id, iccid, auth: this._auth })
					.then(r => r.body.network.id);
				return spin(p, 'Registering the network with the cloud...');
			})
			.then(networkId => {
			// Create the network
				const p = usbDevice.createMeshNetwork({ id: networkId, name: args.params.network_name, password: networkPassword, channel: args.channel });
				return spin(p, 'Creating the network...');
			})
			.then(() => {
			// Leave the listening mode
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
		return this._getDevice(args.params.assisting_device).then(d => {
			assistDevice = d;
			// Get the joiner device. Do not fail if the device is not claimed
			return this._getDevice(args.params.new_device, true);
		})
			.then(d => {
				joinerDevice = d; // Can be null
				// Get the ID of the assisting device's network
				return this._getDeviceNetworkId(assistDevice);
			})
			.then(id => {
				networkId = id;
				if (!networkId) {
					throw new Error('The assisting device is not a member of any mesh network');
				}
				// Open the assisting device
				return this._openUsbDeviceById(assistDevice.id, args.params.assisting_device);
			})
			.then(d => {
				assistUsbDevice = d;
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
				if (!joinerDevice) {
					return null;
				}
				return this._getDeviceNetworkId(joinerDevice);
			})
			.then(joinerNetworkId => {
				let p = when.resolve();
				if (joinerNetworkId) {
					if (joinerNetworkId === networkId) {
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
					p = p.then(() => this._removeDevice(joinerUsbDevice, joinerNetworkId));
				}
				return p.then(() => {
					if (args.password) {
						return args.password;
					}
					// Ask for the network password
					return prompt({
						name: 'password',
						type: 'password',
						message: 'Enter the network password'
					})
						.then(r => r.password);
				})
					.then(password => {
						// Start the commissioner role
						const p = assistUsbDevice.meshAuth(password).then(() => assistUsbDevice.startCommissioner());
						return spin(p, 'Preparing the assisting device...');
					})
					.then(() => {
						// Register the joiner device with the cloud
						const p = this._api.addMeshNetworkDevice({ networkId, deviceId: joinerUsbDevice.id, auth: this._auth });
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
							const p = this._api.getClaimCode({ auth: this._auth }).then(r => {
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
		return this._getDevice(args.params.device).then(d => {
			device = d;
			// Check if the device is a member of a network
			return this._getDeviceNetworkId(device);
		})
			.then(networkId => {
				let p = when.resolve();
				if (!networkId) {
					console.log('This device is not a member of any mesh network.');
					return p; // Done
				}
				if (!args.yes) {
					p = p.then(() => prompt({
						name: 'remove',
						type: 'confirm',
						message: 'Are you sure you want to remove this device from the network?',
						default: false
					}))
						.then(r => {
							if (!r.remove) {
								throw new Error('Cancelled');
							}
						});
				}
				return p.then(() => {
				// Open the device
					return this._openUsbDeviceById(device.id, args.params.device);
				})
					.then(d => {
						usbDevice = d;
						// Remove the device from the network
						return this._removeDevice(usbDevice, networkId);
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
		return when.resolve().then(() => {
			if (args.params.network) {
				// Get the network
				return this._getNetwork(args.params.network).then(network => [network]);
			}
			// Get all networks
			const p = this._api.listMeshNetworks({ auth: this._auth }).then(r => {
				return r.body.sort((a, b) => a.name.localeCompare(b.name)); // Sort networks by name
			});
			return spin(p, 'Retrieving networks...');
		})
			.then(networks => {
				let p = when.resolve();
				if (networks.length === 0) {
					console.log('No networks found.');
					return p; // Done
				}
				const listDevices = !args['networks-only'];
				if (listDevices) {
				// Get network devices
					p = p.then(() => sequence(networks.map(network => () => {
						return this._api.listMeshNetworkDevices({ networkId: network.id, auth: this._auth }).then(r => {
							network.devices = r.body.sort((a, b) => (a.name || '').localeCompare(b.name || '')); // Sort devices by name
						});
					})));
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
		return this._openUsbDeviceById(args.params.device).then(d => {
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
		return this._openUsbDeviceById(args.params.device).then(d => {
			usbDevice = d;
			// Scan for networks
			const p = usbDevice.scanMeshNetworks();
			return spin(p, 'Scanning for networks...');
		})
			.then(networks => {
				if (networks.length === 0) {
					console.log('No networks found.');
				} else {
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

	_getDeviceNetworkId(device) {
		const network = device.network;
		if (!network || !network.id) {
			return when.resolve(null);
		}
		// FIXME: The API service shows that a device is a member of a network even if the network is
		// pending, so we have to check the network status explicitly:
		// https://github.com/particle-iot/api-service/pull/601
		if (network.role && network.role.state === 'confirmed') {
			return when.resolve(network.id);
		}
		const p = when.resolve().then(() => this._api.getMeshNetwork({ networkId: network.id, auth: this._auth })).then(() => {
			return network.id; // The device is a member of a confirmed network
		})
			.catch(e => {
				if (e.statusCode === 404) {
					return null; // The device is a member of a pending network
				}
				throw e;
			});
		return spin(p, 'Getting network information...');
	}

	_removeDevice(usbDevice, networkId) {
		return spin(this._api.removeMeshNetworkDevice({ networkId, deviceId: usbDevice.id, auth: this._auth }),
			'Removing the device from the network...').then(() => {
			return spin(usbDevice.leaveMeshNetwork(), 'Clearing the network credentials...');
		});
	}

	_openUsbDeviceById(deviceId, displayName = null) {
		return openUsbDeviceById({ id: deviceId, displayName, api: this._api, auth: this._auth }).then(usbDevice => {
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
		const p = when.resolve().then(() => this._api.getMeshNetwork({ networkId, auth: this._auth })).then(r => {
			return r.body;
		}).catch(e => {
			if (e.statusCode === 404) {
				throw new Error(`Network not found: ${networkId}`);
			}
			throw e;
		});
		return spin(p, 'Getting network information...');
	}
};
