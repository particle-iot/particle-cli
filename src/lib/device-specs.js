const { PLATFORMS } = require('./platform');
const { knownAppsForPlatform } = require('./known-apps');

/* Device specs have the following shape:

	'2b04:d006': { // DFU vendor and product IDs, as reported by dfu-util -l
		productName: 'Photon',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: 1,
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: 1,
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: 1,
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: 1,
			alg: 'ec'
		},
		factoryReset: {
			address: '0x080e0000',
			alt: 0
		},
		userFirmware: {
			address: '0x080a0000',
			alt: 0,
			size: 128*1024
		},
		systemFirmwareOne: {
			address: '0x08020000',
			alt: 0
		},
		systemFirmwareTwo: {
			address: '0x08060000',
			alt: 0
		},
		otaRegion: {
			address: '0x080c0000',
			alt: 0
		},
		otaFlag: {
			address: '1753',
			alt: 1,
			size: 1
		},
		knownApps: {
			tinker: 'tinker-0.4.5-photon.bin',
			doctor: 'photon_doctor.bin',
		},
		serial: {
			vid: '2b04',
			pid: 'c006',
			deviceId: deviceIdFromSerialNumber
		},
		defaultProtocol: 'tcp',
		productId: 6,
		features: [
			'wifi',
			'tcp'
		],
	}
*/

const keysDctOffsets = {
	generation1: {
		tcpServerKey: {
			address: 0x00001000,
			size: 2048,
			format: 'der',
			alt: 1,
			addressOffset: 384,
			portOffset: 450
		},
		tcpPrivateKey: {
			address: 0x00002000,
			size: 1024,
			format: 'der',
			alt: 1
		}
	},
	laterGenerations: {
		tcpServerKey: {
			address: 2082,
			size: 512,
			format: 'der',
			alt: 1,
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: 3298,
			size: 320,
			format: 'der',
			alt: 1,
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: 34,
			size: 612,
			format: 'der',
			alt: 1,
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: 3106,
			size: 192,
			format: 'der',
			alt: 1,
			alg: 'ec'
		}
	}
};

// additional specs that are not included in the device constants library
const additionalSpecs = {
	core: {
		writePadding: 2,
	},
	electron: {
		alternativeProtocol: 'tcp'
	}
};

// Devices running older Device OS don't set the USB serial number to the device ID so check the format
function deviceIdFromSerialNumber(serialNumber) {
	const found = /[0-9A-Fa-f]{24}/.exec(serialNumber);
	if (found) {
		return found[0].toLowerCase();
	}
}
function generateDeviceSpecs() {
	return PLATFORMS.reduce((specs, device) => {
		const key = `${device.dfu.vendorId.replace(/0x/, '')}:${device.dfu.productId.replace(/0x/, '')}`;

		specs[key] = {
			name: device.name,
			productName: device.displayName,
			productId: device.id, // platform ID
			generation: device.generation,
			features: device.features,
			defaultProtocol: device.features.includes('tcp') ? 'tcp' : 'udp',
			serial: {
				vid: device.usb.vendorId.replace(/0x/, ''),
				pid: device.usb.productId.replace(/0x/, ''),
				...(device.generation <= 2 && { deviceId: deviceIdFromSerialNumber })
			},

			knownApps: knownAppsForPlatform(device.name),

			// add the offsets to server and device keys in DCT
			...(device.generation === 1 ? keysDctOffsets.generation1 : keysDctOffsets.laterGenerations),

			// add the segments where DFU can read/write
			...device.dfu.segments,

			// add platform specific specs
			...additionalSpecs[device.name]
		};

		return specs;
	}, {});
}

module.exports = generateDeviceSpecs();
