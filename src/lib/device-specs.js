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

module.exports = {
	keysDctOffsets
};
