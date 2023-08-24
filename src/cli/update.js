module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'update', 'Update the system firmware of a device via USB', {
		params: '[device]',
		options: {
			'target': {
				description: 'The firmware version to update. Defaults to latest version.',
			}
		},
		handler: (args) => {
			const UpdateCommand = require('../cmd/update');
			return new UpdateCommand().updateDevice(args.params.device, args);
		},
		examples: {
			'$0 $command red': 'Update the system firmware of device red',
			'$0 $command --target 5.0.0 blue': 'Update the system firmware of device blue to version 5.0.0'
		}
	});
};

