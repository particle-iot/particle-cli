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

	return usb;
};
