import settings from '../../settings';

function usbCommand() {
	if (!usbCommand._instance) {
		const UsbCommand = require('../cmd/usb').UsbCommand;
		usbCommand._instance = new UsbCommand(settings);
	}
	return usbCommand._instance;
}

export default ({ commandProcessor, root }) => {
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
		},
		'one': {
			description: 'Send the command to a single device connected to the host computer',
			boolean: true
		}
	};

	commandProcessor.createCommand(usb, 'start-listening', 'Put a device into listening mode', {
		params: '[devices...]',
		options: commonOptions,
		handler: (args) => {
			return usbCommand().startListening(args);
		}
	});

	commandProcessor.createCommand(usb, 'stop-listening', 'Exit listening mode', {
		params: '[devices...]',
		options: commonOptions,
		handler: (args) => {
			return usbCommand().stopListening(args);
		}
	});

	commandProcessor.createCommand(usb, 'safe-mode', 'Put a device into safe mode', {
		params: '[devices...]',
		options: commonOptions,
		handler: (args) => {
			return usbCommand().safeMode(args);
		}
	});

	commandProcessor.createCommand(usb, 'dfu', 'Put a device into DFU mode', {
		params: '[devices...]',
		options: commonOptions,
		handler: (args) => {
			return usbCommand().dfu(args);
		}
	});

	commandProcessor.createCommand(usb, 'reset', 'Reset a device', {
		params: '[devices...]',
		options: commonOptions,
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
