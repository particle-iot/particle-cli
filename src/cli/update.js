module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'update', 'Update Device OS on a device via USB', {
		params: '[device]',
		options: {
			'target': {
				description: 'The Device OS version to update. Defaults to latest version.',
			}
		},
		handler: (args) => {
			const UpdateCommand = require('../cmd/update');
			return new UpdateCommand().updateDevice(args.params.device, args);
		},
		examples: {
			'$0 $command': 'Update Device OS on the device connected over USB',
			'$0 $command red': 'Update Device OS on device red',
			'$0 $command --target 5.0.0 blue': 'Update Device OS on device blue to version 5.0.0'
		}
	});
};
