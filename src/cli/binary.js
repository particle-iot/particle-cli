export default ({ commandProcessor, root }) => {
	const binary = commandProcessor.createCategory(root, 'binary', 'Inspect binaries');

	commandProcessor.createCommand(binary, 'inspect', 'Describe binary contents', {
		params: '<filename>',
		handler: (args) => {
			const BinaryCommand = require('../cmd/binary');
			return new BinaryCommand(args).inspectBinary();
		},
		examples: {
			'$0 $command firmware.bin': 'Describe contents of firmware.bin'
		}
	});

	return binary;
};
