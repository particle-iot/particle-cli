const path = require('path');

function deviceIdFromSerialNumber(serialNumber) {
	const found = /[0-9A-Fa-f]{24}/.exec(serialNumber);
	if (found) {
		return found[0].toLowerCase();
	}
}

const specs = {
	// key is DFU id shown in dfu-util -l
	'1d50:607f': {
		productName: 'Core',
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
			'tinker': 'core_tinker.bin',
			'doctor': 'core_doctor.bin',
			'cc3000': 'cc3000-patch-programmer.bin',
			'cc3000_1_14': 'cc3000-patch-programmer_1_14.bin',
			'voodoo': 'voodoospark.bin',
			'deep_update_2014_06': 'deep_update_2014_06.bin'
		},
		serial: {
			vid: '1d50',
			pid: '607d',
			serialNumber: 'Spark_Core',
			deviceId: deviceIdFromSerialNumber
		},
		defaultProtocol: 'tcp',
		productId: 0,
		writePadding: 2,
		features: [
			'wifi',
			'cc3000',
		],
	},
	'2b04:d006': {
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
			'tinker': 'tinker-0.4.5-photon.bin',
			'doctor': 'photon_doctor.bin',
			'voodoo': 'voodoospark.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c006',
			serialNumber: 'Particle_Photon',
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
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
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
			alt: '1'
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
			'tinker': 'tinker-0.4.5-p1.bin',
			'doctor': 'p1_doctor.bin',
			'voodoo': 'voodoospark.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c008',
			serialNumber: 'Particle_P1',
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
			'tinker': 'electron_tinker.bin',
			'doctor': 'electron_doctor.bin',
			'tinker-usb-debugging': 'tinker-usb-debugging-0.6.0-electron.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00a',
			serialNumber: 'Particle_Electron',
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
	'2b04:d058': {
		productName: 'Duo',
		tcpServerKey: {
			address: '2082',
			size: 512,
			format: 'der',
			alt: '1',
			alg: 'rsa',
			addressOffset: 384,
			portOffset: 450
		},
		tcpPrivateKey: {
			address: '34',
			size: 612,
			format: 'der',
			alt: '1',
			alg: 'rsa'
		},
		factoryReset: {
			address: '0x00140000',
			alt: '2'
		},
		userFirmware: {
			address: '0x080C0000',
			alt: '0'
		},
		systemFirmwareOne: {
			address: '0x08020000',
			alt: '0'
		},
		systemFirmwareTwo: {
			address: '0x08040000',
			alt: '0'
		},
		knownApps: {

		},
		serial: {
			vid: '2b04',
			pid: 'c058',
			serialNumber: 'RedBear_Duo'
		},
		defaultProtocol: 'tcp',
		productId: 88,
		features: [
			'wifi',
		],
	},
	'2b04:d00c': {
		productName: 'Argon',
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
			variant: 'gen3',
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
			'tinker': 'tinker-0.8.0-rc.27-argon.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00c',
			serialNumber: 'Particle_Argon'
		},
		defaultProtocol: 'udp',
		productId: 12,
	},
	'2b04:d016': {
		productName: 'A SoM',
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
			variant: 'gen3',
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
			pid: 'c016',
			serialNumber: 'Particle_Argon'
		},
		defaultProtocol: 'udp',
		productId: 22,
	},
	'2b04:d00d': {
		productName: 'Boron',
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
			variant: 'gen3',
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
			'tinker': 'tinker-0.8.0-rc.27-boron.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00d',
			serialNumber: 'Particle_Boron'
		},
		defaultProtocol: 'udp',
		productId: 13,
	},
	'2b04:d017': {
		productName: 'B SoM',
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
			variant: 'gen3',
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
			pid: 'c017',
			serialNumber: 'Particle_Boron'
		},
		defaultProtocol: 'udp',
		productId: 23,
	},
	'2b04:d00e': {
		productName: 'Xenon',
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
			variant: 'gen3',
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
			'tinker': 'tinker-0.8.0-rc.27-xenon.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00e',
			serialNumber: 'Particle_Xenon'
		},
		defaultProtocol: 'udp',
		productId: 14,
	},

	'2b04:d018': {
		productName: 'X SoM',
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
			variant: 'gen3',
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
			pid: 'c018',
			serialNumber: 'Particle_Xenon'
		},
		defaultProtocol: 'udp',
		productId: 24,
	}
};

//fix the paths on the known apps mappings
Object.keys(specs).forEach((id) => {
	const deviceSpecs = specs[id];
	const knownApps = deviceSpecs['knownApps'];
	for (let appName in knownApps) {
		knownApps[appName] = path.join(__dirname, '../../../assets/binaries', knownApps[appName]);
	}
});

module.exports = specs;

// device spec "model"
// key: "vendor:device" ID
// var model = {
// 	tcpServerKey: {
// 		address: String,
// 		size: String,
// 		format: String,
// 		alt: String
// 	},
// 	tcpPrivateKey: {
// 		address: String,
// 		size: String,
// 		format: String,
// 		alt: String
// 	},
// 	factoryReset: {
// 		address: String,
// 		alt: String
// 	},
// 	userFirmware: {
// 		address: String,
// 		alt: String
// 	}
// };
