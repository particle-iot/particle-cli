const unindent = require('../lib/unindent');

export default ({ commandProcessor, root }) => {
	const serial = commandProcessor.createCategory(root, 'serial', 'Simple serial interface to your devices');

	const portOption = {
		'port': {
			describe: 'Use this serial port instead of auto-detecting. Useful if there are more than 1 connected device'
		}
	};

	commandProcessor.createCommand(serial, 'list', 'Show devices connected via serial to your computer', {
		handler: (args) => {
			const CloudCommands = require('../cmd/serial');
			return new CloudCommands(args).listDevices();
		}
	});

	commandProcessor.createCommand(serial, 'monitor', 'Connect and display messages from a device', {
		options: Object.assign({
			'follow': {
				boolean: true,
				description: 'Reopen the port after it closes, for example when the device resets'
			}
		}, portOption),
		handler: (args) => {
			const CloudCommands = require('../cmd/serial');
			return new CloudCommands(args).monitorPort();
		}
	});

	commandProcessor.createCommand(serial, 'identify', 'Ask for and display device ID via serial', {
		options: portOption,
		handler: (args) => {
			const CloudCommands = require('../cmd/serial');
			return new CloudCommands(args).identifyDevice();
		}
	});

	commandProcessor.createCommand(serial, 'wifi', 'Configure Wi-Fi credentials over serial', {
		options: Object.assign({
			'file': {
				description: 'Take the credentials from a JSON file instead of prompting for them'
			}
		}, portOption),
		handler: (args) => {
			const CloudCommands = require('../cmd/serial');
			return new CloudCommands(args).configureWifi();
		},
		examples: {
			'$0 $command': 'Prompt for Wi-Fi credentials and send them to a device over serial',
			'$0 $command --file credentials.json': 'Read Wi-Fi credentials from credentials.json and send them to a device over serial'
		},
		epilogue: unindent(`
			The JSON file for passing Wi-Fi credentials should look like this:
			{
			  "network": "my_ssid",
			  "security": "WPA2_AES",
			  "password": "my_password"
			}
			
			The security property can be NONE, WEP, WPA2_AES, WPA2_TKIP, WPA2_AES+TKIP, WPA_AES, WPA_TKIP, WPA_AES+TKIP.
			For enterprise Wi-Fi, set security to WPA_802.1x or WPA2_802.1x and provide the eap, username, outer_identity, client_certificate, private_key and root_ca properties.
		`)
	});

	commandProcessor.createCommand(serial, 'mac', 'Ask for and display MAC address via serial', {
		options: portOption,
		handler: (args) => {
			const CloudCommands = require('../cmd/serial');
			return new CloudCommands(args).deviceMac();
		}
	});

	commandProcessor.createCommand(serial, 'inspect', 'Ask for and display device module information via serial', {
		options: portOption,
		handler: (args) => {
			const CloudCommands = require('../cmd/serial');
			return new CloudCommands(args).inspectDevice();
		}
	});

	commandProcessor.createCommand(serial, 'flash', 'Flash firmware over serial using YMODEM protocol', {
		params: '<binary>',
		options: portOption,
		handler: (args) => {
			const CloudCommands = require('../cmd/serial');
			return new CloudCommands(args).flashDevice();
		}
	});

	commandProcessor.createCommand(serial, 'claim', 'Claim a device with the given claim code', {
		params: '<claimCode>',
		options: portOption,
		handler: (args) => {
			const CloudCommands = require('../cmd/serial');
			return new CloudCommands(args).claimDevice();
		}
	});

	return serial;
};
