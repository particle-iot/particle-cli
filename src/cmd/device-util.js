import { spin } from '../app/ui';

import { openDeviceById, NotFoundError } from 'particle-usb';
import when from 'when';

export function isDeviceId(str) {
  return /^[0-9a-f]{24}$/i.test(str);
}

export function getDevice({ id, api, auth, displayName = null, dontThrow = false }) {
	const p = api.getDevice({ deviceId: id, auth })
		.then(r => r.body)
		.catch(e => {
			if (e.statusCode == 403 || e.statusCode == 404) {
				if (dontThrow) {
					return null;
				}
				throw new Error(`Device not found: ${displayName || id}`);
			}
			throw e;
		});
	return spin(p, 'Getting device information...');
}

export function openUsbDevice({ id, api, auth, dfuMode = false, displayName = null }) {
	return when.resolve().then(() => {
		if (isDeviceId(id)) {
			// Try to open the device straight away
			return openDeviceById(id).catch(e => {
				if (!(e instanceof NotFoundError)) {
					throw e;
				}
			});
		}
	})
	.then(usbDevice => {
		if (!usbDevice) {
			return getDevice({ id, api, auth, displayName }).then(device => {
				if (device.id == id) {
					throw new NotFoundError();
				}
				return openDeviceById(device.id);
			})
			.catch(e => {
				if (e instanceof NotFoundError) {
					throw new Error(`Unable to connect to the device ${displayName || id}. Make sure the device is connected to the host computer via USB`);
				}
				throw e;
			});
		}
		return usbDevice;
	})
	.then(usbDevice => {
		if (!dfuMode && usbDevice.isInDfuMode) {
			return usbDevice.close().then(() => {
				throw new Error('The device should not be in DFU mode');
			});
		}
		return usbDevice;
	});
}
