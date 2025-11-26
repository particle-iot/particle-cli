'use strict';
const os = require('os');

module.exports = ({ commandProcessor, root }) => {
	const envVars = commandProcessor.createCategory(root, 'env-vars', 'create, update, list and remove environment variables', { alias: 'ev' });
	const aliasDescription = 'Alias: this command can be also executed as ev';


	commandProcessor.createCommand(envVars, 'list', `List all environment variables. ${os.EOL}${aliasDescription} list[options]`, {
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'product': {
				description: 'Specify the product id'
			},
			'device': {
				description: 'Specify the device id'
			},
			'json': {
				description: 'Show the list in json format',
				boolean: true
			}
		},
		handler: (args) => {
			const EnvVarsCommand = require('../cmd/env-vars');
			return new EnvVarsCommand(args).list(args);
		},
		examples: {
			'$0 $command': 'List all environment variables.',
			'$0 $command --org <org>': 'List all environment variables from an specific organization',
			'$0 $command --product <productId>': 'List all environment variables from an specific product',
			'$0 $command --device <deviceId>': 'List all environment variables from an specific device',
		}
	});

};
