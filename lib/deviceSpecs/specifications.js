module.exports = specifications = {

	'1d50:607f': { // Core
		serverKey: {
			address: "0x00001000",
			size: "2048",
			format: "der",
			alt: "1"
		},
		privateKey: {
			address: "0x00002000",
			size: "1024",
			format: "der",
			alt: "1"
		},
		factoryReset: {
			address: "0x00020000",
			alt: "1"
		},
		userFirmware: {
			address: "0x08005000",
			alt: "0"
		}
	},

	'2b04:d006': { // Photon
		serverKey: {
			address: "2082",
			size: "420",
			format: "der",
			alt: "1"
		},
		privateKey: {
			address: "34",
			size: "612",
			format: "der",
			alt: "1"
		},
		factoryReset: {
			address: "0x080E0000",
			alt: "0"
		},
		userFirmware: {
			address: "0x080A0000",
			alt: "0"
		}
	},
}

// device spec "model"
// key: "vendor:device" ID
var model = {
	serverKey: {
		address: String,
		size: String,
		format: String,
		alt: String
	},
	privateKey: {
		address: String,
		size: String,
		format: String,
		alt: String
	},
	factoryReset: {
		address: String,
		alt: String
	},
	userFirmware: {
		address: String,
		alt: String
	}
}
