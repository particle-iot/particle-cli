export default ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'flash', 'Send firmware to your device', {
		params: '[device] [files...]',
		options: {
			'cloud': {
				boolean: true,
				description: 'Flash over the air to the device. Default if no other flag provided'
			},
			'usb': {
				boolean: true,
				description: 'Flash over USB using the DFU utility'
			},
			'serial': {
				boolean: true,
				description: 'Flash over a virtual serial port'
			},
			'factory': {
				boolean: true,
				describe: 'Flash user application to the factory reset location. Only available for DFU'
			},
			'force': {
				boolean: true,
				describe: 'Flash even when binary does not pass pre-flash checks'
			},
		},
		handler: (args) => {
			const FlashCommand = require('../cmd/flash');
			return new FlashCommand(args).flash();
		}
	});
};
