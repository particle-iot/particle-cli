export default ({ commandProcessor, root }) => {
	const keys = commandProcessor.createCategory(root, 'keys', "Commands to manage your device's keypair and server public key");

	const protocolOption = {
		'protocol': {
			description: 'Communication protocol for the device using the key. tcp or udp'
		}
	};

	commandProcessor.createCommand(keys, 'new', 'Generate a new set of keys for your device', {
		params: '[filename]',
		options: protocolOption,
		handler: (args) => {
			const KeyCommands = require('../cmd/key');
			return new KeyCommands(args).makeNewKey();
		}
	});

	commandProcessor.createCommand(keys, 'load', 'Load a key saved in a file onto your device', {
		params: '<filename>',
		handler: (args) => {
			const KeyCommands = require('../cmd/key');
			return new KeyCommands(args).writeKeyToDevice();
		}
	});

	commandProcessor.createCommand(keys, 'save', 'Save a key from your device to a file', {
		params: '<filename>',
		options: {
			'force': {
				boolean: true,
				default: false,
				description: 'Force overwriting of <filename> if it exists',
			}
		},
		handler: (args) => {
			const KeyCommands = require('../cmd/key');
			return new KeyCommands(args).saveKeyFromDevice();
		}
	});

	commandProcessor.createCommand(keys, 'send', "Tell a server which key you'd like to use by sending your public key in PEM format", {
		params: '<device> <filename>',
		options: {
			'product_id': {
				number: true,
				description: 'The product ID to use when provisioning a new device'
			}
		},
		handler: (args) => {
			const KeyCommands = require('../cmd/key');
			return new KeyCommands(args).sendPublicKeyToServer();
		}
	});

	commandProcessor.createCommand(keys, 'doctor', 'Creates and assigns a new key to your device, and uploads it to the cloud', {
		params: '<device>',
		options: protocolOption,
		handler: (args) => {
			const KeyCommands = require('../cmd/key');
			return new KeyCommands(args).keyDoctor();
		}
	});

	commandProcessor.createCommand(keys, 'server', 'Switch server public keys.', {
		epilogue: 'Defaults to the Particle public cloud or you can provide another key in DER format and the server hostname or IP and port',
		params: '[filename]',
		options: Object.assign({}, protocolOption, {
			'host': {
				description: 'Hostname or IP address of the server to add to the key'
			},
			'port': {
				description: 'Port number of the server to add to the key'
			}
		}),
		handler: (args) => {
			const KeyCommands = require('../cmd/key');
			return new KeyCommands(args).writeServerPublicKey();
		}
	});

	commandProcessor.createCommand(keys, 'address', 'Read server configured in device server public key', {
		options: protocolOption,
		handler: (args) => {
			const KeyCommands = require('../cmd/key');
			return new KeyCommands(args).readServerAddress();
		}
	});

	commandProcessor.createCommand(keys, 'protocol', 'Retrieve or change transport protocol the device uses to communicate with the cloud', {
		options: protocolOption,
		handler: (args) => {
			const KeyCommands = require('../cmd/key');
			return new KeyCommands(args).transportProtocol();
		}
	});
};
