export default ({ commandProcessor, root }) => {
	const keys = commandProcessor.createCategory(root, 'keys', "Commands to manage your device's keypair and server public key");

	commandProcessor.createCommand(keys, 'save', 'Save a key from your device to a file', {
		params: '<filename>',
		options: {
			'force': {
				boolean: true,
				default: false,
				description: 'Force overwriting of <filename> if it exists',
			}
		},
		handler: (args) => {
			const KeyCommands = require('../cmd/keys');
			return new KeyCommands(args).saveKeyFromDevice();
		}
	});
};
