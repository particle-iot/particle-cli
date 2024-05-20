const unindent = require('../lib/unindent');

module.exports = ({ commandProcessor, root }) => {
	const wifi = commandProcessor.createCategory(root, 'wifi', 'Configure Wi-Fi credentials to your device(s)');

	const portOption = {
		'port': {
			describe: 'Use this serial port instead of auto-detecting. Useful if there are more than 1 connected device'
		}
	};

    commandProcessor.createCommand(wifi, 'add', 'Adds a WiFi network to your device', {
		options: Object.assign({
			'file': {
				description: 'Take the credentials from a JSON file instead of prompting for them'
			}
		}, portOption),
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
			  "security": "WPA2_AES",
			  "password": "my_password"
			}
			
			The security property can be NONE, WEP, WPA2_AES, WPA2_TKIP, WPA2_AES+TKIP, WPA_AES, WPA_TKIP, WPA_AES+TKIP.
			For enterprise Wi-Fi, set security to WPA_802.1x or WPA2_802.1x and provide the eap, username, outer_identity, client_certificate, private_key and root_ca properties.
		`)
	});

	commandProcessor.createCommand(wifi, 'join', 'Joins a wifi network', {
		options: Object.assign({
			'file': {
				description: 'Take the credentials from a JSON file instead of prompting for them'
			},
			'ssid': {
				description: 'The name of the network to join'
			},
		}, portOption),
		handler: (args) => {
			const WiFiCommands = require('../cmd/wifi');
			if (args.ssid) {
				return new WiFiCommands().joinKnownNetwork(args);
			}
			return new WiFiCommands().joinNetwork(args);
		},
		examples: {
			'$0 $command': 'Prompt for Wi-Fi credentials and send them to a device',
			'$0 $command --file credentials.json': 'Read Wi-Fi credentials from credentials.json and send them to a device'
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

	commandProcessor.createCommand(wifi, 'clear', 'Clears the list of wifi credentials on your device', {
		handler: () => {
			const WiFiCommands = require('../cmd/wifi');
			return new WiFiCommands().clearNetworks();
		},
		examples: {
			'$0 $command': 'Clears the list of wifi credentials on your device',
		}
	});

	commandProcessor.createCommand(wifi, 'list', 'Lists the wifi networks on your device', {
		handler: () => {
			const WiFiCommands = require('../cmd/wifi');
			return new WiFiCommands().listNetworks();
		},
		examples: {
			'$0 $command': 'Clears the list of wifi credentials on your device',
		}
	});

	commandProcessor.createCommand(wifi, 'remove', 'Removes a network from the device', {
		params: '<ssid>',
		handler: (args) => {
			const WiFiCommands = require('../cmd/wifi');
			return new WiFiCommands().removeNetwork(args.params.ssid);
		},
		examples: {
			'$0 $command ssid': 'Removes network from the device',
		}
	});
	
	return wifi;
};

