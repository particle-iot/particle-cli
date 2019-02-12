import ParticleApi from './api';
import { formatDeviceInfo } from './formatting';
import { spin } from '../app/ui';

import { getDevices } from 'particle-usb';

export class UsbCommand {
	constructor(settings) {
		this._apiToken = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._apiToken }).api;
	}

	async list(args) {
		// Enumerate USB devices
		const usbDevices = await getDevices();
		if (usbDevices.length == 0) {
			console.log('No devices found.');
			return;
		}
		// Get device info
		let devices = [];
		for (let usbDevice of usbDevices) {
			const device = {};
			try {
				await usbDevice.open();
				device.id = usbDevice.id;
				device.type = usbDevice.type;
				const r = await spin(this._api.getDevice({ deviceId: device.id, auth: this._apiToken }),
						'Getting device information...');
				device.name = r.body.name;
			} catch (e) {
				if (e.statusCode != 403 && e.statusCode != 404) {
					throw e;
				}
				device.name = '';
			} finally {
				await usbDevice.close();
			}
			devices.push(device);
		}
		devices = devices.sort((a, b) => a.name.localeCompare(b.name)); // Sort devices by name
		for (let device of devices) {
			console.log(formatDeviceInfo(device));
		}
	}
}
