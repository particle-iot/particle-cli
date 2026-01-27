'use strict';
module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'profile', 'Configure and switch between multiple accounts', {
		params: '[profile] [setting] [value]',
		options: {
			'list': {
				boolean: true,
				description: 'Display available configurations'
			}
		},
		handler: (args) => {
			const ProfileCommands = require('../cmd/profile');
			return new ProfileCommands().profileSwitch(args.params.profile, args.params.setting, args.params.value, args);
		},
		examples: {
			'$0 $command company': 'Switch to a profile called company',
			'$0 $command particle': 'Switch back to the default profile',
			'$0 $command set apiUrl http://localhost:9090': 'Change the apiUrl setting for the current profile',
			'$0 $command set proxyUrl http://proxy:8080': 'Change the proxyUrl setting for the current profile'
		}
	});
};

