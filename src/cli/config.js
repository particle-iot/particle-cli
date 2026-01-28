'use strict';

module.exports = ({ commandProcessor, root }) => {
	// Create the main 'config' category
	const config = commandProcessor.createCategory(root, 'config', 'Manage environment variables and secrets');

	// Create 'env' subcategory under config
	const env = commandProcessor.createCategory(config, 'env', 'Manage environment variables');

	// ============================================================
	// ENV COMMANDS (formerly env-vars)
	// ============================================================

	commandProcessor.createCommand(env, 'list', 'List all environment variables', {
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

	commandProcessor.createCommand(env, 'set', 'Set an environment variable', {
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

	commandProcessor.createCommand(env, 'unset', 'Unset an environment variable', {
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
			'$0 $command <key>': 'Unset env var from user\'s sandbox',
		}
	});

	commandProcessor.createCommand(env, 'patch', 'Patch environment variables from a file', {
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

	commandProcessor.createCommand(env, 'render', 'Render environment variables', {
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
			'$0 $command': 'Render environment variables for user\'s sandbox',
		}
	});

	commandProcessor.createCommand(env, 'rollout', 'Rollout environment variables', {
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
			},
			'when': {
				description: 'Specify when to rollout the environment variables',
				choices: ['Immediate', 'Connect']
			}
		},
		handler: (args) => {
			const EnvVarsCommand = require('../cmd/env-vars');
			return new EnvVarsCommand(args).rollout(args);
		},
		examples: {
			'$0 $command --sandbox': 'Rollout environment variables to the user\'s sandbox',
			'$0 $command --sandbox --yes': 'Rollout environment variables to user\'s sandbox without confirmation',
			'$0 $command --org <org> --yes': 'Rollout environment variables for an organization non-interactively',
			'$0 $command --product <productId> --yes': 'Rollout environment variables for a product non-interactively',
			'$0 $command --device <deviceId> --yes': 'Rollout environment variables for a device non-interactively',
		}
	});

	// ============================================================
	// SECRET COMMANDS
	// ============================================================

	const secret = commandProcessor.createCategory(config, 'secret', 'Manage secrets');

	commandProcessor.createCommand(secret, 'list', 'List all created secrets', {
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'json': {
				description: 'Show the list in json format',
				boolean: true
			}
		},
		handler: (args) => {
			const SecretsCommand = require('../cmd/secrets');
			return new SecretsCommand(args).list(args);
		},
		examples: {
			'$0 $command': 'List all secrets',
			'$0 $command --org <org>': 'List all secrets from an specific org'
		}
	});

	commandProcessor.createCommand(secret, 'get', 'Get an specific secret',{
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Secret name'
			}
		},
		handler: (args) => {
			const SecretsCommand = require('../cmd/secrets');
			return new SecretsCommand(args).get(args);
		}
	});

	commandProcessor.createCommand(secret, 'create', 'Creates a new secret', {
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Secret name'
			},
			'value': {
				description: 'Secret value'
			}
		},
		handler: (args) => {
			const SecretsCommand = require('../cmd/secrets');
			return new SecretsCommand(args).create(args);
		}
	});

	commandProcessor.createCommand(secret, 'update', 'Updates the value of an existing secret', {
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Secret name'
			},
			'value': {
				description: 'Secret value'
			}
		},
		handler: (args) => {
			const SecretsCommand = require('../cmd/secrets');
			return new SecretsCommand(args).update(args);
		}
	});

	commandProcessor.createCommand(secret, 'remove', 'Remove an specific secret',{
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Secret name'
			}
		},
		handler: (args) => {
			const SecretsCommand = require('../cmd/secrets');
			return new SecretsCommand(args).remove(args);
		}
	});
};
