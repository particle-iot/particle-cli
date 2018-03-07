export default ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'flash', 'Send firmware to your device', {
		params: '[device|binary] [files...]',
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
		},
		examples: {
			'$0 $command red': 'Compile the source code in the current directory in the cloud and flash to device red',
			'$0 $command green tinker': 'Flash the default Tinker app to device green',
			'$0 $command blue app.ino --target 0.6.3': 'Compile app.ino in the cloud using the 0.6.3 firmware and flash to device blue',
			'$0 $command cyan firmware.bin': 'Flash the pre-compiled binary to device cyan',
			'$0 $command --usb firmware.bin': 'Flash the binary over USB. The device needs to be in DFU mode',
			'$0 $command --serial firmware.bin': 'Flash the binary over virtual serial port. The device needs to be in listening mode'
		}
	});
};
