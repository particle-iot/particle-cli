function token() {
	return {
		cmd: 'AccessTokenCommands',
		options: null,
		name: 'token',
		description: 'tools to manage access tokens (require username/password)',

		init: function () {
			this.addOption('list', 'listAccessTokens', 'List all access tokens for your account');
			this.addOption('revoke', 'revokeAccessToken', 'Revoke an access token');
			this.addOption('new', 'createAccessToken', 'Create a new access token');
		}
	};
}

function binary() {
	return {
		cmd: 'BinaryCommand',
		options: null,
		name: 'binary',
		description: 'inspect binaries',

		init: function () {
			this.addOption('inspect', 'inspectBinary', 'Describe binary contents');
		}
	}
}

function cloud() {
	return {
		cmd: 'CloudCommands',
		options: null,
		name: 'cloud',
		description: 'simple interface for common cloud functions',
		
		init: function () {
			this.addOption('claim', 'claimDevice', 'Register a device with your user account with the cloud');
			this.addOption('list', 'listDevices', 'Displays a list of your devices, as well as their variables and functions');
			this.addOption('remove', 'removeDevice', 'Release a device from your account so that another user may claim it');
			this.addOption('name', 'nameDevice', 'Give a device a name!');
			this.addOption('flash', 'flashDevice', 'Pass a binary, source file, or source directory to a device!');
			this.addOption('compile', 'compileCode', 'Compile a source file, or directory using the cloud service');

			this.addOption('nyan', 'nyanMode', 'How long has this been here?');

			this.addOption('login', 'login', 'Lets you login to the cloud and stores an access token locally');
			this.addOption('logout', 'logout', 'Logs out your session and clears your saved access token');
		},
		
		usagesByName: {
			nyan: [
				'particle cloud nyan',
				'particle cloud nyan my_device_id on',
				'particle cloud nyan my_device_id off',
				'particle cloud nyan all on'
			]
		},
	};
}

function config() {
	return {
		cmd: 'ConfigCommand',
		options: null,
		name: 'config',
		description: 'helps create and switch between groups of commands',

		does: [
			'The config command lets you create groups of settings. ',
			'You can quickly switch to a profile by calling "particle config profile-name". ',
			'This is especially useful for switching to your local server ',
			'or when switching between other environments.  ',
			'Call "particle config particle" to switch back to the normal api server',
			'Use "particle config identify" to see the currently selected configuration profile',
			'Use "particle config list" to see the list of available profiles'
		],
		usage: [
			'particle config local',
			'particle config particle',
			'particle config local apiUrl http://localhost:8080',
			'particle config useSudoForDfu true',
			'particle config list',
			'particle config identify'
		],

		init: function () {
			this.addOption('*', 'configSwitch');
			this.addOption('identify', 'identifyServer', 'Display the current server config information.');
			this.addOption('list', 'listConfigs', 'Display available configurations');
		},
	};
}

function flash() {
	return {
		cmd: 'FlashCommand',
		options: null,
		name: 'flash',
		description: 'copies firmware and data to your device over usb',

		init: function () {
			this.addOption('firmware', 'flashDfu', 'Flashes a local firmware binary to your device over USB');
			this.addOption('cloud', 'flashCloud', 'Flashes a binary to your device wirelessly ');
			this.addOption('*', 'flashSwitch');
		}
	}
}

function functions() {
	return {
		cmd: 'FunctionCommand',
		options: null,
		name: 'function',
		description: 'call functions on your device',

		init: function () {
			this.addOption('list', 'listFunctions', 'List functions provided by your device(s)');
			this.addOption('call', 'callFunction', 'Call a particular function on a device');
		}
	};
}

function help() {
	return {
		cmd: 'HelpCommand',
		options: null,
		name: 'help',
		description: 'Help provides information on available commands in the cli',

		init: function () {
			this.addOption('version', 'showVersion', 'Displays the CLI version');
			this.addOption('*', 'helpCommand', 'Provide extra information about the given command');
		}
	};
}

function keys() {
	return {
		cmd: 'KeyCommands',
		options: null,
		name: 'keys',
		description: 'tools to help you manage keys on your devices',

		init: function () {
			this.addOption('new', 'makeNewKey', 'Generate a new set of keys for your device');
			this.addOption('load', 'writeKeyToDevice', 'Load a saved key on disk onto your device');
			this.addOption('save', 'saveKeyFromDevice', 'Save a key from your device onto your disk');
			this.addOption('send', 'sendPublicKeyToServer', "Tell a server which key you'd like to use by sending your public key");
			this.addOption('doctor', 'keyDoctor', 'Creates and assigns a new key to your device, and uploads it to the cloud');
			this.addOption('server', 'writeServerPublicKey', 'Switch server public keys');
			this.addOption('address', 'readServerAddress', 'Read server configured in device server public key');
			this.addOption('protocol', 'transportProtocol', 'Retrieve or change transport protocol the device uses to communicate with the cloud');
		}
	};
}

function publish() {
	return {
		cmd: 'PublishCommand',
		options: null,
		name: 'publish',
		description: 'Publishes an event to the cloud.',

		init: function () {
			this.addOption('*', 'publishEvent', 'Publishes an event to the cloud');
		}
	};
}

function serial() {
	return {
		cmd: 'SerialCommand',
		options: null,
		name: 'serial',
		description: 'simple serial interface to your devices',

		init: function () {
			this.addOption('list', 'listDevices', 'Show devices connected via serial to your computer');
			this.addOption('monitor', 'monitorSwitch', 'Connect and display messages from a device');
			this.addOption('identify', 'identifyDevice', 'Ask for and display device ID via serial');
			this.addOption('wifi', 'configureWifi', 'Configure Wi-Fi credentials over serial');
			this.addOption('mac', 'deviceMac', 'Ask for and display MAC address via serial');
			this.addOption('inspect', 'inspectDevice', 'Ask for and display device module information via serial');
			this.addOption('flash', 'flashDevice', 'Flash firmware over serial using YMODEM protocol');
		}
	};
}

function setup() {
	var description = 'Helps guide you through the initial setup & claiming of your device';

	return {
		cmd: 'SetupCommand',
		name: 'setup',
		options: null,
		description: description,
		init: function () {
			this.addOption('*', 'setup', description);
		}
	};
}

function subscribe() {
	return {
		cmd: 'SubscribeCommand',
		options: null,
		name: 'subscribe',
		description: 'helpers for watching device event streams',

		init: function () {
			this.addOption('*', 'startListening', 'Starts listening and parsing server sent events from the api to your console');
		}
	};
}

function udp() {
	return {
		cmd: 'UdpCommands',
		options: null,
		name: 'udp',
		description: 'helps repair devices, run patches, check Wi-Fi, and more!',

		init: function () {
			this.addOption('send', 'sendUdpPacket', 'Sends a UDP packet to the specified host and port');
			this.addOption("listen", 'listenUdp', 'Listens for UDP packets on an optional port (default 5549)');
		}
	};
}

function update() {
	return {
		cmd: 'UpdateCommand',
		options: null,
		name: 'update',
		description: 'This command allows you to update the system firmware of your device via USB',

		init: function () {
			this.addOption('*', 'updateDevice', "Update a device's system firmware via USB");
		}
	};
}

function variable() {
	return {
		cmd: 'VariableCommand',
		options: null,
		name: 'variable',
		description: 'retrieve and monitor variables on your device',

		init: function () {
			this.addOption('list', 'listVariables', 'Show variables provided by your device(s)');
			this.addOption('get', 'getValue', 'Retrieve a value from your device');
			this.addOption('monitor', 'monitorVariables', 'Connect and display messages from a device');
		}
	};
}

function webhook() {
	return {
		cmd: 'WebhookCommands',
		options: null,
		name: 'webhook',
		description: 'Webhooks - helpers for reacting to device event streams',
		usagesByName: {
			'create': [
				'particle webhook create hook.json',
				'particle webhook create eventName url deviceID',
				'',
				'The url will receive a request with the event name and data whenever one of your devices ',
				'publish an event starting with the provided name.  If you do optionally provide a json ',
				'filename you can set lots of advanced properties when creating your hook',

				'',
				'Optional JSON Template:',
				//JSON.stringify(WebhookCommand.HookJsonTemplate, null, 2),

			]
		},

		HookJsonTemplate: {
			'event': 'my-event',
			'url': 'https://my-website.com/fancy_things.php',
			'deviceid': 'optionally filter by providing a device id',

			'_': 'The following parameters are optional',
			'mydevices': 'true/false',
			'requestType': 'GET/POST/PUT/DELETE',
			'form': null,
			'headers': null,
			'query': null,
			'json': null,
			'auth': null,
			'responseTemplate': null,
			'rejectUnauthorized': 'true/false'
		},

		init: function () {
			//TODO: better way to render and insert this template
			this.usagesByName.create = this.usagesByName.create.concat(
				JSON.stringify(this.HookJsonTemplate, null, 2).split('\n')
			);

			this.addOption('create', 'createHook', 'Creates a postback to the given url when your event is sent');
			this.addOption('list', 'listHooks', 'Show your current Webhooks');
			this.addOption('delete', 'deleteHook', 'Deletes a Webhook');
			this.addOption('POST', 'createPOSTHook', 'Create a new POST request hook');
			this.addOption('GET', 'createGETHook', 'Create a new GET request hook');
		}
	};
}

var descriptors = [
	token,
	binary,
	cloud,
	config,
	flash,
	functions,
	help,
	keys,
	publish,
	serial,
	setup,
	subscribe,
	udp,
	update,
	variable,
	webhook
];

module.exports = {
	find: function (name) {
		var result;
		descriptors.forEach(function (item) {
			var desc = item();
			if (desc.name === name) {
				result = desc;
			}
		});
		return result;
	},

	names: function () {
		var result = [];
		descriptors.forEach(function (stub) {
			result.push(stub().name);
		});
		return result;
	},

	apply: function (name, command, mustExist) {
		var desc = this.find(name);
		if (!desc) {
			if (mustExist) {
				throw Error('no descriptor named ' + name);
			}
			return null;
		}
		for (var key in desc) {
			if (desc.hasOwnProperty(key)) {
				if (desc[key]!==null || command[key]===undefined) {
					command[key] = desc[key];
				}
			}
		}
		command.init.bind(command)();
		return command;
	}

};
