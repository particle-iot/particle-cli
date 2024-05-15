const settings = require('../../settings');
const utilities = require('../lib/utilities');

function usbCommand() {
	if (!usbCommand._instance) {
		const UsbCommand = require('../cmd/usb');
		usbCommand._instance = new UsbCommand(settings);
	}
	return usbCommand._instance;
}

module.exports = ({ commandProcessor, root }) => {
	const usb = commandProcessor.createCategory(root, 'usb', 'Control USB devices');

	commandProcessor.createCommand(usb, 'list', 'List the devices connected to the host computer', {
		params: '[filter]',
		options: {
			'exclude-dfu': {
				description: 'Do not list devices which are in DFU mode',
				boolean: true
			},
			'ids-only': {
				description: 'Print only device IDs',
				boolean: true
			}
		},
		handler: (args) => {
			return usbCommand().list(args);
		},
		epilogue: `Param filter can be: online, offline, a platform name (${Object.keys(utilities.knownPlatformIds()).join(', ')}), a device ID or name`
	});

	// Common options for start-listening, stop-listening, safe-mode, dfu and reset
	const commonOptions = {
		'all': {
			description: 'Send the command to all devices connected to the host computer',
			boolean: true
		}
	};

	const startListeningOptions = {
		params: '[devices...]',
		options: commonOptions,
		examples: {
			'$0 $command my_device': 'Put a device named "my_device" into the listening mode',
			'$0 $command --all': 'Put all devices connected to the host computer into the listening mode'
		},
		handler: (args) => {
			return usbCommand().startListening(args);
		}
	};

	commandProcessor.createCommand(usb, 'start-listening', 'Put a device into the listening mode', startListeningOptions);
	commandProcessor.createCommand(usb, 'listen', 'alias for start-listening', startListeningOptions);

	commandProcessor.createCommand(usb, 'stop-listening', 'Make a device exit the listening mode', {
		params: '[devices...]',
		options: commonOptions,
		examples: {
			'$0 $command my_device': 'Make a device named "my_device" exit the listening mode',
			'$0 $command --all': 'Make all devices connected to the host computer exit the listening mode'
		},
		handler: (args) => {
			return usbCommand().stopListening(args);
		}
	});

	commandProcessor.createCommand(usb, 'safe-mode', 'Put a device into the safe mode', {
		params: '[devices...]',
		options: commonOptions,
		examples: {
			'$0 $command my_device': 'Put a device named "my_device" into the safe mode',
			'$0 $command --all': 'Put all devices connected to the host computer into the safe mode'
		},
		handler: (args) => {
			return usbCommand().safeMode(args);
		}
	});

	commandProcessor.createCommand(usb, 'dfu', 'Put a device into the DFU mode', {
		params: '[devices...]',
		options: commonOptions,
		examples: {
			'$0 $command my_device': 'Put a device named "my_device" into the DFU mode',
			'$0 $command --all': 'Put all devices connected to the host computer into the DFU mode'
		},
		handler: (args) => {
			return usbCommand().dfu(args);
		}
	});

	commandProcessor.createCommand(usb, 'reset', 'Reset a device', {
		params: '[devices...]',
		options: commonOptions,
		examples: {
			'$0 $command my_device': 'Reset a device named "my_device"',
			'$0 $command --all': 'Reset all devices connected to the host computer'
		},
		handler: (args) => {
			return usbCommand().reset(args);
		}
	});

	commandProcessor.createCommand(usb, 'setup-done', 'Set the setup done flag', {
		params: '[devices...]',
		options: {
			'reset': {
				description: 'Clear the setup done flag',
				boolean: true
			},
			...commonOptions
		},
		examples: {
			'$0 $command my_device': 'Set the setup done flag on the device "my_device"',
			'$0 $command --reset my_device': 'Clear the setup done flag on the device "my_device"',
			'$0 $command --all': 'Set the setup done flag on all devices connected to the host computer',
		},
		handler: (args) => {
			return usbCommand().setSetupDone(args);
		}
	});

	commandProcessor.createCommand(usb, 'configure', 'Update the system USB configuration', {
		handler: (args) => {
			return usbCommand().configure(args);
		}
	});

	commandProcessor.createCommand(usb, 'cloud-status', 'Check a device\'s cloud connection state', {
		params: '<device>',
		options: {
			'until': {
				description: 'Poll your device for a specific connection state and then exit',
				choices: [
					'unknown',
					'disconnected',
					'connecting',
					'connected',
					'disconnecting'
				]
			},
			'timeout': {
				description: 'How long should polling wait (in ms) for the requested status?',
				number: true,
				default: 1 * 60 * 1000
			}
		},
		examples: {
			'$0 $command blue': 'Check the cloud connection status for the device named `blue`',
			'$0 $command red --until connected': 'Poll cloud connection status for the device named `red` until it reports `connected`'
		},
		handler: (args) => {
			return usbCommand().cloudStatus(args);
		}
	});

	commandProcessor.createCommand(usb, 'network-interfaces', 'Gets the network configuration of the device', {
		params: '[devices...]',
		options: commonOptions,
		examples: {
			'$0 $command': 'Gets the network configuration of the device',
			'$0 $command --all': 'Gets the network configuration of all the devices connected over USB',
			'$0 $command my_device': 'Gets the network configuration of the device named "my_device"'
		},
		handler: (args) => {
			return usbCommand().getNetworkIfaces(args);
		}
	});

	return usb;
};

