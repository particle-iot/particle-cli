const unindent = require('../lib/unindent');

module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'flash', 'Send firmware to your device', {
		params: '[device|binary] [files...]',
		options: {
			'cloud': {
				boolean: true,
				description: 'Flash over the air to the device. Default if no other flag provided'
			},
			'local': {
				boolean: true,
				description: 'Flash locally, updating Device OS as needed'
			},
			'usb': {
				boolean: true,
				description: 'Flash a single file over USB'
			},
			'serial': {
				boolean: true,
				description: 'DEPRECATED. Use --local instead'
			},
			'factory': {
				boolean: true,
				describe: 'Flash user application to the factory reset location. Only available for USB flash'
			},
			'yes': {
				boolean: true,
				description: 'Answer yes to all questions'
			},
			'target': {
				description: 'The firmware version to compile against. Defaults to latest version.'
			},
			'application-only': {
				boolean: true,
				description: 'Do not update Device OS when flashing locally'
			},
			'port': {
				describe: 'Use this serial port instead of auto-detecting. Useful if there are more than 1 connected device. Only available for serial'
			},
			'tachyon' : {
				boolean: true,
				description: 'Flash Tachyon'
			}
		},
		handler: (args) => {
			const FlashCommand = require('../cmd/flash');
			return new FlashCommand().flash(args.params.device, args.params.binary, args.params.files, args);
		},
		examples: {
			'$0 $command red': 'Compile the source code in the current directory in the cloud and flash to device red',
			'$0 $command green tinker': 'Flash the default Tinker app to device green',
			'$0 $command blue app.ino --target 5.0.0': 'Compile app.ino in the cloud using the 5.0.0 firmware and flash to device blue',
			'$0 $command cyan firmware.bin': 'Flash the pre-compiled binary to device cyan',
			'$0 $command --local': 'Compile the source code in the current directory in the cloud and flash to the device connected over USB',
			'$0 $command --local <deviceId> application.bin': 'Compile the source code in the current directory in the cloud and flash to the device connected over USB',
			'$0 $command --local --target 5.0.0': 'Compile the source code in the current directory in the cloud against the target version and flash to the device connected over USB',
			'$0 $command --local application.bin': 'Flash the pre-compiled binary to the device connected over USB',
			'$0 $command --local application.zip': 'Flash the pre-compiled binary and assets from the bundle to the device connected over USB',
			'$0 $command --local tinker': 'Flash the default Tinker app to the device connected over USB',
			'$0 $command --usb firmware.bin': 'Flash the binary over USB',
			'$0 $command --tachyon': 'Flash Tachyon from the files in the current directory',
			'$0 $command --tachyon /path/to/unpackaged-tool-and-files': 'Flash Tachyon from the files in the specified directory',
		},
		epilogue: unindent(`
		  When passing the --local flag, Device OS will be updated if the version on the device is outdated.
		  When passing both the --local and --target flash, Device OS will be updated to the target version.
		  To avoid this behavior, pass the --application-only flag.
		`)
	});
};
