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
			'ids-only': {
				description: 'Print only device IDs',
				boolean: true
			},
			'exclude-dfu': {
				description: 'Do not list devices which are in DFU mode',
				boolean: true
			}
		},
		handler: (args) => {
			return usbCommand().list(args);
		}
	});

	commandProcessor.createCommand(usb, 'dfu', 'Put a device into DFU mode', {
		params: '[device]',
		handler: (args) => {
			return usbCommand().dfu(args);
		}
	});

	commandProcessor.createCommand(usb, 'reset', 'Reset a device', {
		params: '[device]',
		handler: (args) => {
			return usbCommand().reset(args);
		}
	});

	return usb;
};
