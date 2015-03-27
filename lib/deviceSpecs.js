module.exports = specs = {

	'1d50:607f': {
		serverKey: {
			address: "0x00001000",
			size: "2048",
			format: "",
			alt: "1"
		},
		privateKey: {
			address: "0x00002000",
			size: "1024",
			format: "",
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
	'2b04:d006': {
		serverKey: {
			address: "1250",
			size: "294",
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

		},
		userFirmware: {

		}
	},
	_: {
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
};
