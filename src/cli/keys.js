module.exports = ({ commandProcessor, root }) => {
	const keys = commandProcessor.createCategory(root, 'keys', "Manage your device's key pair and server public key");

	commandProcessor.createCommand(keys, 'new', 'Generate a new set of keys for your device', {
		params: '[filename]',
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().makeNewKey(args);
		}
	});

	commandProcessor.createCommand(keys, 'load', 'Load a key saved in a file onto your device', {
		params: '[filename]',
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().writeKeyToDevice(args);
		}
	});

	commandProcessor.createCommand(keys, 'save', 'Save a key from your device to a file', {
		params: '[filename]',
		options: {
			'force': {
				boolean: true,
				default: false,
				description: 'Force overwriting of filename if it exists',
			}
		},
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().saveKeyFromDevice(args);
		}
	});

	commandProcessor.createCommand(keys, 'send', "Tell a server which key you'd like to use by sending your public key in PEM format", {
		params: '[deviceID] [filename]',
		options: {
			'product_id': {
				number: true,
				description: 'The product ID to use when provisioning a new device'
			}
		},
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().sendPublicKeyToServer(args);
		}
	});

	commandProcessor.createCommand(keys, 'doctor', 'Creates and assigns a new key to your device, and uploads it to the cloud', {
		params: '[deviceID]',
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().keyDoctor(args);
		}
	});

	commandProcessor.createCommand(keys, 'server', 'Switch server public keys.', {
		epilogue: 'Defaults to the Particle public cloud or you can provide another key in DER format and the server hostname or IP and port',
		params: '[filename] [outputFilename]',
		options: {
			'host': {
				description: 'Hostname or IP address of the server to add to the key'
			},
			'port': {
				number: true,
				description: 'Port number of the server to add to the key'
			},
			'deviceType': {
				description: 'Generate key file for the provided device type'
			}
		},
		handler: (args) => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().writeServerPublicKey(args);
		}
	});

	commandProcessor.createCommand(keys, 'address', 'Read server configured in device server public key', {
		handler: () => {
			const KeysCommand = require('../cmd/keys');
			return new KeysCommand().readServerAddress();
		}
	});

	return keys;
};

