'use strict';

module.exports = {

	'1d50:607f': { // Core
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
			'cc3000': 'cc3000-patch-programmer.bin',
			'cc3000_1_14': 'cc3000-patch-programmer_1_14.bin',
			'voodoo': 'voodoospark.bin',
			'deep_update_2014_06': 'deep_update_2014_06.bin'
		},
		serial: {
			vid: '1d50',
			pid: '607d'
		},
		productName: 'Core',
		defaultProtocol: 'tcp'
	},
	'2b04:d006': { // Photon
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
		factoryReset: {
			address: '0x080E0000',
			alt: '0'
		},
		userFirmware: {
			address: '0x080A0000',
			alt: '0'
		},
		SystemFirmwareOne: {
			address: '0x08020000',
			alt: '0'
		},
		SystemFirmwareTwo: {
			address: '0x08060000',
			alt: '0'
		},
		knownApps: {
			'tinker': 'photon_tinker.bin',
			'voodoo': 'voodoospark.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c006'
		},
		productName: 'Photon',
		defaultProtocol: 'tcp'
	},
	'2b04:d008': { // P1
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
		transport: {
			address: 2977,
			size: 1,
			alt: '1'
		},
		factoryReset: {
			address: '0x080E0000',
			alt: '0'
		},
		userFirmware: {
			address: '0x080A0000',
			alt: '0'
		},
		SystemFirmwareOne: {
			address: '0x08020000',
			alt: '0'
		},
		SystemFirmwareTwo: {
			address: '0x08060000',
			alt: '0'
		},
		knownApps: {
			'tinker': 'p1_tinker.bin',
			'voodoo': 'voodoospark.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c008'
		},
		productName: 'P1',
		defaultProtocol: 'tcp'
	},
	'2b04:d00a': { // Electron
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
		SystemFirmwareOne: {
			address: '0x08020000',
			alt: '0'
		},
		SystemFirmwareTwo: {
			address: '0x08040000',
			alt: '0'
		},
		SystemFirmwareThree: {
			address: '0x08060000',
			alt: '0'
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
			'tinker': 'electron_tinker.bin'
		},
		serial: {
			vid: '2b04',
			pid: 'c00a'
		},
		productName: 'Electron',
		defaultProtocol: 'udp'
	}
};

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
