const unindent = require('../lib/unindent');

module.exports = ({ commandProcessor, root }) => {
	const wifi = commandProcessor.createCategory(root, 'wifi', 'Configure Wi-Fi credentials to your device (Supported on Gen 3+ devices).');

	commandProcessor.createCommand(wifi, 'add', 'Adds a Wi-Fi network to your device', {
		options: Object.assign({
			'file': {
				description: 'Take the credentials from a JSON file instead of prompting for them'
			}
		}),
		handler: (args) => {
			const WiFiCommands = require('../cmd/wifi');
			return new WiFiCommands().addNetwork(args);
		},
		examples: {
			'$0 $command': 'Prompt for Wi-Fi credentials and send them to a device',
			'$0 $command --file credentials.json': 'Read Wi-Fi credentials from credentials.json and send them to a device'
		},
		epilogue: unindent(`
			The JSON file for passing Wi-Fi credentials should look like this:
			{
			  "network": "my_ssid",
			  "security": "WPA2_PSK",
			  "password": "my_password",
			  "hidden": false
			}
			
			The security property can be NONE, WEP, WPA_PSK, WPA2_PSK, WPA3_PSK.
			Enterprise networks are not supported.
		`)
	});

	commandProcessor.createCommand(wifi, 'join', 'Joins a Wi-Fi network', {
		options: Object.assign({
			'file': {
				description: 'Take the credentials from a JSON file instead of prompting for them'
			},
			'ssid': {
				description: 'The name of the network to join'
			},
		}),
		handler: (args) => {
			const WiFiCommands = require('../cmd/wifi');
			if (args.ssid) {
				return new WiFiCommands().joinKnownNetwork(args);
			}
			return new WiFiCommands().joinNetwork(args);
		},
		examples: {
			'$0 $command': 'Prompt for Wi-Fi credentials and send them to a device',
			'$0 $command --file credentials.json': 'Read Wi-Fi credentials from credentials.json and send them to a device',
			'$0 $command --ssid <SSID>': 'Join a pre-configured network specified by SSID. Pre-configure a network using `particle wifi add`'
		},
		epilogue: unindent(`
			The JSON file for passing Wi-Fi credentials should look like this:
			{
			  "network": "my_ssid",
			  "security": "WPA2_PSK",
			  "password": "my_password",
			  "hidden": false
			}
			
			The security property can be NONE, WEP, WPA_PSK, WPA2_PSK, WPA3_PSK.
			Enterprise networks are not supported.
		`)
	});

	commandProcessor.createCommand(wifi, 'clear', 'Clears the list of Wi-Fi networks on your device', {
		handler: () => {
			const WiFiCommands = require('../cmd/wifi');
			return new WiFiCommands().clearNetworks();
		},
		examples: {
			'$0 $command': 'Clears the list of Wi-Fi networks on your device',
		}
	});

	commandProcessor.createCommand(wifi, 'list', 'Lists the Wi-Fi networks on your device', {
		handler: () => {
			const WiFiCommands = require('../cmd/wifi');
			return new WiFiCommands().listNetworks();
		},
		examples: {
			'$0 $command': 'Lists the wifi networks on your device',
		}
	});

	commandProcessor.createCommand(wifi, 'remove', 'Removes a Wi-Fi network from the device', {
		options: Object.assign({
			'ssid': {
				description: 'The name of the network to remove'
			}
		}),
		handler: (args) => {
			const WiFiCommands = require('../cmd/wifi');
			return new WiFiCommands().removeNetwork(args);
		},
		examples: {
			'$0 $command ssid': 'Removes a network specified by SSID from the device',
		}
	});

	commandProcessor.createCommand(wifi, 'current', 'Gets the current Wi-Fi network', {
		handler: () => {
			const WiFiCommands = require('../cmd/wifi');
			return new WiFiCommands().getCurrentNetwork();
		},
		examples: {
			'$0 $command ssid': 'Gets the Wi-Fi network that the device is currently connected to',
		}
	});

	return wifi;
};

