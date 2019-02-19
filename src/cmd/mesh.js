import ParticleApi from './api';
import { getDevice, openUsbDevice } from './device-util';
import { formatDeviceInfo } from './formatting';
import { platformsById } from './constants';
import { prompt, spin } from '../app/ui';

export class MeshCommand {
	constructor(settings) {
		this._auth = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._auth }).api;
	}

	async create(args) {
		let usbDevice = null;
		try {
			const deviceIdOrName = args.params.device;
			const device = await this._getDevice(deviceIdOrName);
			// Make sure the device is connected to the host via USB
			usbDevice = await this._openUsbDevice(device.id, deviceIdOrName);
			const hasNetwork = await this._checkMembership(device);
			if (hasNetwork) {
				if (!args.yes) {
					const r = await prompt({
						name: 'remove',
						type: 'confirm',
						message: `This device is already a member of a mesh network. Do you want to remove it from that network and proceed?`,
						default: false
					});
					if (!r.remove) {
						throw new Error('Cancelled.');
					}
				}
				await this._removeDevice(usbDevice, device.network.id);
			}
			let password = args.password;
			if (!password) {
				const r = await prompt([{
					name: 'password',
					type: 'password',
					message: 'Enter a password for the new network'
				}, {
					name: 'confirm',
					type: 'password',
					message: 'Confirm the password'
				}]);
				if (r.password != r.confirm) {
					throw new Error('The entered passwords do not match');
				}
				password = r.password;
			}
			const networkName = args.params['network name'];
			const r = await spin(this._api.createMeshNetwork({ name: networkName, deviceId: device.id, auth: this._auth }),
					'Registering the network with the cloud...');
			const networkId = r.body.network.id;
			await spin(usbDevice.createMeshNetwork({ id: networkId, name: networkName, password, channel: args.channel }),
					'Creating the network...');
			await usbDevice.leaveListeningMode(); // Just in case
			console.log('Done! The device will be registered in the network once it is connected to the cloud.');
		} finally {
			if (usbDevice) {
				await usbDevice.close();
			}
		}
	}

	async add(args) {
		let joinerUsbDevice = null;
		let assistUsbDevice = null;
		try {
			const assistIdOrName = args.params['assisting device'];
			assistUsbDevice = await this._openUsbDevice(assistIdOrName);
			const network = await assistUsbDevice.getMeshNetworkInfo();
			if (!network) {
				throw new Error('The assisting device is not a member of any mesh network');
			}
			const joinerIdOrName = args.params['new device'];
			joinerUsbDevice = await this._openUsbDevice(joinerIdOrName);
			// Keep the joiner device in the listening mode
			await joinerUsbDevice.enterListeningMode();
			const joinerNetwork = await joinerUsbDevice.getMeshNetworkInfo();
			if (joinerNetwork) {
				if (joinerNetwork.id == network.id) {
					console.log('The device is already a member of the network.');
					return; // Done
				}
				if (!args.yes) {
					const r = await prompt({
						name: 'remove',
						type: 'confirm',
						message: `The device is already a member of another network. Do you want to remove it from that network and proceed?`,
						default: false
					});
					if (!r.remove) {
						throw new Error('Cancelled.');
					}
				}
				await this._removeDevice(joinerUsbDevice, joinerNetwork.id);
			}
			await spin(this._api.addMeshNetworkDevice({ networkId: network.id, deviceId: joinerUsbDevice.id, auth: this._auth}),
					'Registering the device in the network...');
			const p = assistUsbDevice.startCommissioner()
					.then(() => joinerUsbDevice.joinMeshNetwork(assistUsbDevice))
					.then(() => assistUsbDevice.startCommissioner());
			await spin(p, 'Adding the device to the network...');
			// Make sure the joiner device is claimed
			// FIXME: Normally, this should be done via `particle setup`, but it doesn't support mesh devices yet
			const joinerDevice = await getDevice({ id: joinerUsbDevice.id, api: this._api, auth: this._auth, dontThrow: true });
			if (!joinerDevice) {
				const r = await spin(this._api.getClaimCode({ auth: this._auth }),
						'Claiming the device to your account...');
				await joinerUsbDevice.setClaimCode(r.body.claim_code);
				await joinerUsbDevice.setSetupDone();
			}
			await joinerUsbDevice.leaveListeningMode();
			console.log('Done! The device should now connect to the cloud.');
		} finally {
			if (joinerUsbDevice) {
				await joinerUsbDevice.close();
			}
			if (assistUsbDevice) {
				await assistUsbDevice.close();
			}
		}
	}

	async remove(args) {
		let usbDevice = null;
		try {
			const deviceIdOrName = args.params.device;
			const device = await this._getDevice(deviceIdOrName);
			const hasNetwork = await this._checkMembership(device);
			if (!hasNetwork) {
				throw new Error('The device is not a member of a mesh network');
			}
			usbDevice = await this._openUsbDevice(device.id, deviceIdOrName);
			if (!args.yes) {
				const r = await prompt({
					name: 'remove',
					type: 'confirm',
					message: `Are you sure you want to remove this device from the network?`,
					default: false
				});
				if (!r.remove) {
					throw new Error('Cancelled.');
				}
			}
			await this._removeDevice(usbDevice, device.network.id);
			console.log('Done.');
		} finally {
			if (usbDevice) {
				await usbDevice.close();
			}
		}
	}

	async list(args) {
		let networks = null;
		if (args.params.network) {
			const network = await this._getNetwork(args.params.network);
			networks = [ network ];
		} else {
			const r = await spin(this._api.listMeshNetworks({ auth: this._auth }),
					'Retrieving networks...');
			networks = r.body;
			if (networks.length == 0) {
				console.log('No networks found.');
				return;
			}
			// Sort networks by name
			networks = networks.sort((a, b) => a.name.localeCompare(b.name));
		}
		const listDevices = !args['networks-only'];
		if (listDevices) {
			for (let network of networks) {
				const r = await spin(this._api.listMeshNetworkDevices({ networkId: network.id, auth: this._auth }),
						'Retrieving network devices...');
				// Sort devices by name
				network.devices = r.body.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
			}
		}
		for (let network of networks) {
			console.log(network.name);
			if (listDevices && network.devices.length > 0) {
				console.log('  devices:');
				for (let device of network.devices) {
					const type = platformsById[device.platform_id];
					console.log(`    ${formatDeviceInfo({ id: device.id, name: device.name, type })}`);
				}
			}
		}
	}

	async info(args) {
		let usbDevice = null;
		try {
			usbDevice = await this._openUsbDevice(args.params.device);
			const r = await usbDevice.getMeshNetworkInfo();
			if (r) {
				console.log(`This device is a member of ${r.name}.`);
			} else {
				console.log('This device is not a member of any mesh network.');
			}
		} finally {
			if (usbDevice) {
				await usbDevice.close();
			}
		}
	}

	async scan(args) {
		let usbDevice = null;
		try {
			usbDevice = await this._openUsbDevice(args.params.device);
			let networks = await spin(usbDevice.scanMeshNetworks(), 'Scanning for mesh networks...');
			if (networks.length > 0) {
				networks = networks.sort((a, b) => a.name.localeCompare(b.name)); // Sort networks by name
				networks.forEach(network => console.log(network.name));
			} else {
				console.log('No networks found.');
			}
		} finally {
			if (usbDevice) {
				await usbDevice.close();
			}
		}
	}

	async _checkMembership(device) {
		const network = device.network;
		if (!network || !network.id) {
			return false;
		}
		if (network.role && network.role.state == 'confirmed') {
			return true;
		}
		// FIXME: The API service considers a device, which role within a network is not confirmed,
		// a legit member of that network if the network itself is confirmed, and an attempt to add
		// such a device to another network without removing it from the current network will fail.
		// The API service doesn't expose information about pending networks, and the only way to
		// check if a network is confirmed is to try to query its info
		try {
			await spin(this._api.getMeshNetwork({ networkId: network.id, auth: this._auth }),
					'Getting network information...');
		} catch (e) {
			if (e.statusCode == 404) {
				return false; // The device is a member of a pending network
			}
			throw e;
		}
		return true; // The device is a member of a confirmed network
	}

	async _removeDevice(usbDevice, networkId) {
		await spin(this._api.removeMeshNetworkDevice({ networkId: networkId, deviceId: usbDevice.id, auth: this._auth }),
				'Removing the device from the network...');
		await spin(usbDevice.leaveMeshNetwork(), 'Clearing the network credentials...');
	}

	async _openUsbDevice(idOrName, displayName) {
		const usbDevice = await openUsbDevice({ id: idOrName, displayName, api: this._api, auth: this._auth });
		if (!usbDevice.isMeshDevice) {
			await usbDevice.close();
			throw new Error('The device does not support mesh networking');
		}
		return usbDevice;
	}

	async _getDevice(idOrName) {
		return getDevice({ id: idOrName, api: this._api, auth: this._auth });
	}

	async _getNetwork(idOrName) {
		try {
			const r = await spin(this._api.getMeshNetwork({ networkId: idOrName, auth: this._auth }),
					'Getting network information...');
			return r.body;
		} catch (e) {
			if (e.statusCode == 404) {
				throw new Error(`Network not found: ${idOrName}`);
			}
			throw e;
		}
	}
}
