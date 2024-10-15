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

	commandProcessor.createCommand(binary, 'list-assets', 'Lists assets present in an application binary', {
		params: '<file>',
		handler: (args) => {
			const BinaryCommand = require('../cmd/binary');
			return new BinaryCommand().listAssetsFromApplication(args.params.file);
		},
		examples: {
			'$0 $command app-with-assets.bin': 'Show the list of assets in the application binary'
		}
	});

	commandProcessor.createCommand(binary, 'strip-assets', 'Remove assets from application binary', {
		params: '<file>',
		handler: (args) => {
			const BinaryCommand = require('../cmd/binary');
			return new BinaryCommand().stripAssetsFromApplication(args.params.file);
		},
		examples: {
			'$0 $command app-with-assets.bin': 'Remove assets from the application binary'
		}
	});

	return binary;
};
