import { spin } from '../app/ui';

import { openDeviceById, NotFoundError } from 'particle-usb';

export function isDeviceId(str) {
  return /^[0-9a-f]{24}$/i.test(str);
}

export async function getDevice({ id, api, auth, displayName = null, dontThrow = false }) {
	try {
		const r = await spin(api.getDevice({ deviceId: id, auth }),
				'Getting device information...');
		return r.body;
	} catch (e) {
		if (e.statusCode == 403 || e.statusCode == 404) {
			if (dontThrow) {
				return null;
			}
			throw new Error(`Device not found: ${displayName || id}`);
		}
		throw e;
	}
}

export async function openUsbDevice({ id, api, auth, dfuMode = false, displayName = null }) {
	let usbDevice = null
	if (isDeviceId(id)) {
		// Try to open the device straight away
		try {
			usbDevice = await openDeviceById(id);
		} catch (e) {
			if (!(e instanceof NotFoundError)) {
				throw e;
			}
		}
	}
	if (!usbDevice) {
		// Get the device ID
		const device = await getDevice({ id, api, auth, displayName });
		try {
			if (device.id == id) {
				throw new NotFoundError();
			}
			usbDevice = await openDeviceById(device.id);
		} catch (e) {
			if (e instanceof NotFoundError) {
				throw new Error(`Unable to connect to the device ${displayName || id}. Make sure the device is connected to the host computer via USB`);
			}
			throw e;
		}
	}
	if (!dfuMode && usbDevice.isInDfuMode) {
		await usbDevice.close();
		throw new Error('The device should not be in DFU mode');
	}
	return usbDevice;
}
