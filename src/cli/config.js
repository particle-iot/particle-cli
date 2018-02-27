export default ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'config', 'Configure and switch between multiple accounts', {
		params: '[profile] [setting] [value]',
		options: {
			'list': {
				description: 'Display available configurations'
			}
		},
		handler: (args) => {
			const ConfigCommands = require('../cmd/config');
			return new ConfigCommands(args).configSwitch();
		}
	});
};
