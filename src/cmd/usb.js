import ParticleApi from './api';
import { getDevice, openUsbDevice } from './device-util';
import { formatDeviceInfo } from './formatting';

import { getDevices as getUsbDevices } from 'particle-usb';

export class UsbCommand {
	constructor(settings) {
		this._auth = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._auth }).api;
	}

	async list(args) {
		// Enumerate USB devices
		const usbDevices = await getUsbDevices();
		if (usbDevices.length == 0) {
			console.log('No devices found.');
			return;
		}
		// Get device info
		let devices = [];
		for (let usbDevice of usbDevices) {
			await usbDevice.open();
			try {
				let name = null;
				const device = await getDevice({ id: usbDevice.id, api: this._api, auth: this._auth, dontThrow: true });
				if (device) {
					name = device.name;
				}
				devices.push({
					id: usbDevice.id,
					type: usbDevice.type,
					name: name || ''
				});
			} finally {
				await usbDevice.close();
			}
		}
		devices = devices.sort((a, b) => a.name.localeCompare(b.name)); // Sort devices by name
		for (let device of devices) {
			console.log(formatDeviceInfo(device));
		}
	}

	async dfu(args) {
		let usbDevice = null;
		if (args.params.device) {
			usbDevice = await openUsbDevice({ id: args.params.device, api: this._api, auth: this._auth });
		} else {
			// Device ID is optional if there's a single device attached to the host
			const usbDevices = await getUsbDevices();
			if (usbDevices.length > 1) {
				throw new Error('Device ID or name is missing.');
			} else if (usbDevices.length == 0) {
				throw new Error('No devices found.');
			}
			usbDevice = usbDevices[0];
			if (usbDevice.isInDfuMode) {
				console.log('The device is already in DFU mode.');
				return;
			}
			await usbDevice.open();
		}
		await usbDevice.enterDfuMode();
		await usbDevice.close();
		console.log('Done.');
	}
}
