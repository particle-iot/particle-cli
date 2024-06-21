module.exports = ({ commandProcessor, root }) => {
	const binary = commandProcessor.createCategory(root, 'binary', 'Inspect binaries');

	commandProcessor.createCommand(binary, 'inspect', 'Describe binary contents', {
		params: '<filename>',
		handler: (args) => {
			const BinaryCommand = require('../cmd/binary');
			return new BinaryCommand().inspectBinary(args.params.filename);
		},
		examples: {
			'$0 $command firmware.bin': 'Describe contents of firmware.bin'
		}
	});

	commandProcessor.createCommand(binary, 'enable-device-protection', 'Create a protected bootloader binary', {
		params: '<file>',
		options: {
			'saveTo': {
				description: 'Specify the filename for the protected binary'
			}
		},
		handler: (args) => {
			const BinaryCommand = require('../cmd/binary');
			return new BinaryCommand().createProtectedBinary({ saveTo: args.saveTo, file: args.params.file, verbose: true });
		},
		examples: {
			'$0 $command bootloader.bin': 'Provide bootloader binary to protect'
		}
	});

	return binary;
};
