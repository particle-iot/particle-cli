const path = require('path');
const fs = require('fs');
const deviceConstants = require('@particle/device-constants');

/* Device specs have the following shape:

	'2b04:d006': { // USB vendor and product IDs
		productName: 'Photon',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		factoryReset: {
			address: '0x080E0000',
			alt: '0'
		},
		userFirmware: {
			address: '0x080A0000',
			alt: '0',
			size: 128*1024
		},
		systemFirmwareOne: {
			address: '0x08020000',
			alt: '0'
		},
		systemFirmwareTwo: {
			address: '0x08060000',
			alt: '0'
		},
		otaRegion: {
			address: '0x080C0000',
			alt: '0'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
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
			'system-firmware',
			'antenna-selection',
			'softap',
		],
	}
*/

const keysDctOffsets = {
	generation1: {
		tcpServerKey: {
			address: '0x00001000',
			size: 2048,
			format: 'der',
			alt: '1',
			addressOffset: 384,
			portOffset: 450
		},
		tcpPrivateKey: {
			address: '0x00002000',
			size: 1024,
			format: 'der',
			alt: '1'
		}
	},
	laterGenerations: {
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
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

// Walk the assets/knownApps/${name} directory to find known app binaries for this platform
function knownAppsForPlatform(name) {
	const platformKnownAppsPath = path.join(__dirname, '../../../assets/knownApps', name);
	try {
		return fs.readdirSync(platformKnownAppsPath).reduce((knownApps, appName) => {
			try {
				const appPath = path.join(platformKnownAppsPath, appName);
				const binaries = fs.readdirSync(appPath);
				const appBinary = binaries.filter(filename => filename.match(/\.bin$/))[0];
				if (appBinary) {
					knownApps[appName] = path.join(appPath, appBinary);
				}
			} catch (e) {
				// ignore errors
			}

			return knownApps;
		}, {});
	} catch (e) {
		// no known apps for this platform
		return {};
	}
}

function generateDeviceSpecs(deviceConstants) {
	const cliDevices = Object.values(deviceConstants).filter(d => d.public && Number(d.dfu.vendorId) > 0);

	return cliDevices.reduce((specs, device) => {
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

const specs = {
	// key is DFU id shown in dfu-util -l
	'1d50:607f': {
		productName: 'Core',
		name: 'core',
		tcpServerKey: {
			address: '0x00001000',
			size: 2048,
			format: 'der',
			alt: '1',
			addressOffset: 384,
			portOffset: 450
		},
		tcpPrivateKey: {
			address: '0x00002000',
			size: 1024,
			format: 'der',
			alt: '1'
		},
		factoryReset: {
			address: '0x00020000',
			alt: '1'
		},
		userFirmware: {
			address: '0x08005000',
			alt: '0'
		},
		knownApps: {
			tinker: 'core_tinker.bin',
			doctor: 'core_doctor.bin',
		},
		serial: {
			vid: '1d50',
			pid: '607d',
			deviceId: deviceIdFromSerialNumber
		},
		defaultProtocol: 'tcp',
		productId: 0,
		writePadding: 2,
		features: [
			'wifi'
		],
	},
	'2b04:d006': {
		productName: 'Photon',
		name: 'photon',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		factoryReset: {
			address: '0x080E0000',
			alt: '0'
		},
		userFirmware: {
			address: '0x080A0000',
			alt: '0',
			size: 128*1024
		},
		systemFirmwareOne: {
			address: '0x08020000',
			alt: '0'
		},
		systemFirmwareTwo: {
			address: '0x08060000',
			alt: '0'
		},
		otaRegion: {
			address: '0x080C0000',
			alt: '0'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
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
			'system-firmware',
			'antenna-selection',
			'softap',
		],
	},
	'2b04:d008': {
		productName: 'P1',
		name: 'p1',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		factoryReset: {
			address: '0x080E0000',
			alt: '0'
		},
		userFirmware: {
			address: '0x080A0000',
			alt: '0',
			size: 128*1024
		},
		systemFirmwareOne: {
			address: '0x08020000',
			alt: '0'
		},
		systemFirmwareTwo: {
			address: '0x08060000',
			alt: '0'
		},
		otaRegion: {
			address: '0x080C0000',
			alt: '0'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		knownApps: {
			tinker: 'tinker-0.4.5-p1.bin',
			doctor: 'p1_doctor.bin',
		},
		serial: {
			vid: '2b04',
			pid: 'c008',
			deviceId: deviceIdFromSerialNumber
		},
		defaultProtocol: 'tcp',
		productId: 8,
		features: [
			'wifi',
			'system-firmware',
		],
	},
	'2b04:d00a': {
		productName: 'Electron',
		name: 'electron',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		transport: {
			address: 2977,
			size: 1,
			alt: '1'
		},
		systemFirmwareOne: {
			address: '0x08020000',
			alt: '0'
		},
		systemFirmwareTwo: {
			address: '0x08040000',
			alt: '0'
		},
		systemFirmwareThree: {
			address: '0x08060000',
			alt: '0'
		},
		otaRegion: {
			address: '0x080C0000',
			alt: '0'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		userFirmware: {
			address: '0x08080000',
			alt: '0'
		},
		factoryReset: {
			address: '0x080A0000',
			alt: '0'
		},
		knownApps: {
			tinker: 'electron_tinker.bin',
			doctor: 'electron_doctor.bin',
			'tinker-usb-debugging': 'tinker-usb-debugging-0.6.0-electron.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00a',
			deviceId: deviceIdFromSerialNumber
		},
		defaultProtocol: 'udp',
		alternativeProtocol: 'tcp',
		productId: 10,
		features: [
			'cellular',
			'system-firmware',
		],
	},
	// '2b04:d058': {
	// 	productName: 'Duo',
	//  name: 'duo',
	// 	tcpServerKey: {
	// 		address: '2082',
	// 		size: 512,
	// 		format: 'der',
	// 		alt: '1',
	// 		alg: 'rsa',
	// 		addressOffset: 384,
	// 		portOffset: 450
	// 	},
	// 	tcpPrivateKey: {
	// 		address: '34',
	// 		size: 612,
	// 		format: 'der',
	// 		alt: '1',
	// 		alg: 'rsa'
	// 	},
	// 	factoryReset: {
	// 		address: '0x00140000',
	// 		alt: '2'
	// 	},
	// 	userFirmware: {
	// 		address: '0x080C0000',
	// 		alt: '0'
	// 	},
	// 	systemFirmwareOne: {
	// 		address: '0x08020000',
	// 		alt: '0'
	// 	},
	// 	systemFirmwareTwo: {
	// 		address: '0x08040000',
	// 		alt: '0'
	// 	},
	// 	knownApps: {
	//
	// 	},
	// 	serial: {
	// 		vid: '2b04',
	// 		pid: 'c058'
	// 	},
	// 	defaultProtocol: 'tcp',
	// 	productId: 88,
	// 	features: [
	// 		'wifi',
	// 	],
	// },
	'2b04:d00c': {
		productName: 'Argon',
		name: 'argon',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		userFirmware: {
			address: '0x000D4000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x00030000',
			alt: '0'
		},
		otaRegion: {
			address: '0x80289000',
			alt: '2'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		radioStack: {
			address: '0x00001000',
			alt: '0'
		},
		knownApps: {
			tinker: 'tinker-0.8.0-rc.27-argon.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00c'
		},
		defaultProtocol: 'udp',
		productId: 12,
	},
	'2b04:d016': {
		productName: 'A SoM',
		name: 'asom',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		userFirmware: {
			address: '0x000D4000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x00030000',
			alt: '0'
		},
		otaRegion: {
			address: '0x80289000',
			alt: '2'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		radioStack: {
			address: '0x00001000',
			alt: '0'
		},
		knownApps: {
		},
		serial: {
			vid: '2b04',
			pid: 'c016'
		},
		defaultProtocol: 'udp',
		productId: 22,
	},
	'2b04:d00d': {
		productName: 'Boron',
		name: 'boron',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		userFirmware: {
			address: '0x000D4000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x00030000',
			alt: '0'
		},
		otaRegion: {
			address: '0x80289000',
			alt: '2'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		radioStack: {
			address: '0x00001000',
			alt: '0'
		},
		knownApps: {
			tinker: 'tinker-0.8.0-rc.27-boron.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00d'
		},
		defaultProtocol: 'udp',
		productId: 13,
	},
	'2b04:d017': {
		productName: 'B SoM',
		name: 'bsom',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		userFirmware: {
			address: '0x000D4000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x00030000',
			alt: '0'
		},
		otaRegion: {
			address: '0x80289000',
			alt: '2'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		radioStack: {
			address: '0x00001000',
			alt: '0'
		},
		knownApps: {
			tinker: 'tinker-1.1.0-rc.1-bsom.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c017'
		},
		defaultProtocol: 'udp',
		productId: 23,
	},
	'2b04:d00e': {
		productName: 'Xenon',
		name: 'xenon',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		userFirmware: {
			address: '0x000D4000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x00030000',
			alt: '0'
		},
		otaRegion: {
			address: '0x80289000',
			alt: '2'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		radioStack: {
			address: '0x00001000',
			alt: '0'
		},
		knownApps: {
			tinker: 'tinker-0.8.0-rc.27-xenon.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00e'
		},
		defaultProtocol: 'udp',
		productId: 14,
	},
	'2b04:d018': {
		productName: 'X SoM',
		name: 'xsom',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		userFirmware: {
			address: '0x000D4000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x00030000',
			alt: '0'
		},
		otaRegion: {
			address: '0x80289000',
			alt: '2'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		radioStack: {
			address: '0x00001000',
			alt: '0'
		},
		knownApps: {
		},
		serial: {
			vid: '2b04',
			pid: 'c018'
		},
		defaultProtocol: 'udp',
		productId: 24,
	},
	'2b04:d019': {
		productName: 'B5 SoM',
		name: 'b5som',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		userFirmware: {
			address: '0x000D4000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x00030000',
			alt: '0'
		},
		otaRegion: {
			address: '0x80289000',
			alt: '2'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		radioStack: {
			address: '0x00001000',
			alt: '0'
		},
		knownApps: {
			tinker: 'tinker-1.5.0-b5som.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c019'
		},
		defaultProtocol: 'udp',
		productId: 25,
	},
	'2b04:d01a': {
		productName: 'Asset Tracker',
		name: 'tracker',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		udpServerKey: {
			address: '3298',
			size: 320,
			format: 'der',
			alt: '1',
			alg: 'ec',
			addressOffset: 192,
			portOffset: 258
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		udpPrivateKey: {
			address: '3106',
			size: 192,
			format: 'der',
			alt: '1',
			alg: 'ec'
		},
		userFirmware: {
			address: '0x000D4000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x00030000',
			alt: '0'
		},
		otaRegion: {
			address: '0x80289000',
			alt: '2'
		},
		otaFlag: {
			address: '1753',
			alt: '1',
			size: '1'
		},
		radioStack: {
			address: '0x00001000',
			alt: '0'
		},
		knownApps: {
			tinker: 'tracker-tinker@1.5.4-rc.1.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c01a'
		},
		defaultProtocol: 'udp',
		productId: 26,
	}
};

//fix the paths on the known apps mappings
function fixKnownAppsPaths(specs) {
	Object.keys(specs).forEach((id) => {
		const deviceSpecs = specs[id];
		const knownApps = deviceSpecs['knownApps'];
		for (let appName in knownApps) {
			knownApps[appName] = path.join(__dirname, '../../../assets/knownApps', deviceSpecs['name'], appName, knownApps[appName]);
		}
	});

	return specs;
}


module.exports = fixKnownAppsPaths(specs);

module.exports.specs2 = generateDeviceSpecs(deviceConstants);

