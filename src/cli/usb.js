const settings = require('../../settings');

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
		}
	});

	// Common options for start-listening, stop-listening, safe-mode, dfu and reset
	const commonOptions = {
		'all': {
			description: 'Send the command to all devices connected to the host computer',
			boolean: true
		}
	};

	commandProcessor.createCommand(usb, 'start-listening', 'Put a device into the listening mode', {
		params: '[devices...]',
		options: commonOptions,
		examples: {
			'$0 $command my_device': 'Put a device named "my_device" into the listening mode',
			'$0 $command --all': 'Put all devices connected to the host computer into the listening mode'
		},
		handler: (args) => {
			return usbCommand().startListening(args);
		}
	});

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

	commandProcessor.createCommand(usb, 'configure', 'Update the system USB configuration', {
		handler: (args) => {
			return usbCommand().configure(args);
		}
	});

	return usb;
};

