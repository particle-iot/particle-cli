module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'config', 'Configure and switch between multiple accounts', {
		params: '[profile] [setting] [value]',
		options: {
			'list': {
				boolean: true,
				description: 'Display available configurations'
			}
		},
		handler: (args) => {
			const ConfigCommands = require('../cmd/config');
			return new ConfigCommands().configSwitch(args.params.profile, args.params.setting, args.params.value, args);
		},
		examples: {
			'$0 $command company': 'Switch to a profile called company',
			'$0 $command particle': 'Switch back to the default profile',
			'$0 $command set apiUrl http://localhost:9090': 'Change the apiUrl setting for the current profile'
		}
	});
};

