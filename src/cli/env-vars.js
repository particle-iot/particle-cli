'use strict';
const os = require('os');

module.exports = ({ commandProcessor, root }) => {
	const envVars = commandProcessor.createCategory(root, 'env-vars', 'Create, update, list and remove environment variables', { alias: 'ev', hidden: true });
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

	commandProcessor.createCommand(envVars, 'set', `Set an environment variable ${os.EOL}${aliasDescription} set[options]`, {
		params: '<key> <value>',
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
		},
		handler: (args) => {
			const EnvVarsCommand = require('../cmd/env-vars');
			return new EnvVarsCommand(args).setEnvVars(args);
		},
		examples: {
			'$0 $command <key> <value>': 'Set env var to user\'s sandbox',
		}
	});

	commandProcessor.createCommand(envVars, 'unset', `Unset an environment variable ${os.EOL}${aliasDescription} unset[options]`, {
		params: '<key>',
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
		},
		handler: (args) => {
			const EnvVarsCommand = require('../cmd/env-vars');
			return new EnvVarsCommand(args).unsetEnvVars(args);
		},
		examples: {
			'$0 $command <key>': 'Set env var to user\'s sandbox',
		}
	});

	commandProcessor.createCommand(envVars, 'patch', `patch environment variables from a file ${os.EOL}${aliasDescription} patch[options]`, {
		params: '<filename>',
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
		},
		handler: (args) => {
			const EnvVarsCommand = require('../cmd/env-vars');
			return new EnvVarsCommand(args).patchEnvVars(args);
		},
		examples: {
			'$0 $command <filename>': 'Patch environment variables from a file to user\'s sandbox',
		}
	});

	commandProcessor.createCommand(envVars, 'render', `render environment variables${os.EOL}${aliasDescription} render[options]`, {
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
			return new EnvVarsCommand(args).renderEnvVars(args);
		},
		examples: {
			'$0 $command': 'Patch environment variables from a file to user\'s sandbox',
		}
	});

	commandProcessor.createCommand(envVars, 'rollout', `Rollout environment variables ${os.EOL}${aliasDescription} rollout[options]`, {
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'sandbox': {
				description: 'Rollout environment variables to the user\'s sandbox',
				boolean: true
			},
			'product': {
				description: 'Specify the product id'
			},

			'device': {
				description: 'Specify the device id'
			},
			'yes': {
				description: 'Skip confirmation and perform the rollout non-interactively',
				boolean: true
			}
		},
		handler: (args) => {
			const EnvVarsCommand = require('../cmd/env-vars');
			return new EnvVarsCommand(args).rollout(args);
		},
		examples: {
			'$0 $command': 'Rollout environment variables to user\'s sandbox',
		}
	});

};
