module.exports = ({ commandProcessor, root }) => {
	const keys = commandProcessor.createCategory(root, 'keys', "Manage your device's key pair and server public key");

	const protocolOption = {
		'protocol': {
			description: 'Communication protocol for the device using the key. tcp or udp'
		}
	};

	commandProcessor.createCommand(keys, 'new', 'Generate a new set of keys for your device', {
		params: '[filename]',
		options: protocolOption,
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().makeNewKey(args.params.filename, args);
		}
	});

	commandProcessor.createCommand(keys, 'load', 'Load a key saved in a file onto your device', {
		params: '<filename>',
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().writeKeyToDevice(args.params.filename);
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
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().saveKeyFromDevice(args.params.filename, args);
		}
	});

	commandProcessor.createCommand(keys, 'send', "Tell a server which key you'd like to use by sending your public key in PEM format", {
		params: '<deviceID> <filename>',
		options: {
			'product_id': {
				number: true,
				description: 'The product ID to use when provisioning a new device'
			}
		},
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().sendPublicKeyToServer(args.params.deviceID, args.params.filename, args);
		}
	});

	commandProcessor.createCommand(keys, 'doctor', 'Creates and assigns a new key to your device, and uploads it to the cloud', {
		params: '<deviceID>',
		options: protocolOption,
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().keyDoctor(args.params.deviceID, args);
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
				number: true,
				description: 'Port number of the server to add to the key'
			}
		}),
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().writeServerPublicKey(args.params.filename, args);
		}
	});

	commandProcessor.createCommand(keys, 'address', 'Read server configured in device server public key', {
		options: protocolOption,
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().readServerAddress(args);
		}
	});

	commandProcessor.createCommand(keys, 'protocol', 'Retrieve or change transport protocol the device uses to communicate with the cloud', {
		options: protocolOption,
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().transportProtocol(args);
		}
	});

	return keys;
};

