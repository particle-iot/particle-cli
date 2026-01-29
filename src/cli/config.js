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
			'sandbox': {
				description: 'Target the sandbox',
				boolean: true
			},
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
			const EnvVarsCommand = require('../cmd/env');
			return new EnvVarsCommand(args).list(args);
		},
		examples: {
			'$0 $command --sandbox': 'List all environment variables from sandbox',
			'$0 $command --org <org>': 'List all environment variables from an specific organization',
			'$0 $command --product <productId>': 'List all environment variables from an specific product',
			'$0 $command --device <deviceId>': 'List all environment variables from an specific device',
		}
	});

	commandProcessor.createCommand(env, 'set', 'Set an environment variable', {
		params: '<key> [value]',
		options: {
			'sandbox': {
				description: 'Target the sandbox',
				boolean: true
			},
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
			const EnvVarsCommand = require('../cmd/env');
			return new EnvVarsCommand(args).setEnvVars(args);
		},
		examples: {
			'$0 $command <key> <value> --sandbox': 'Set env var to user\'s sandbox (space format)',
			'$0 $command <key=value> --sandbox': 'Set env var to user\'s sandbox (equal sign format)',
			'$0 $command <key> <value> --org <org>': 'Set env var for an organization',
			'$0 $command <key=value> --product <productId>': 'Set env var for a product',
			'$0 $command <key> <value> --device <deviceId>': 'Set env var for a device',
		}
	});

	commandProcessor.createCommand(env, 'delete', 'Delete an environment variable', {
		params: '<key>',
		options: {
			'sandbox': {
				description: 'Target the sandbox',
				boolean: true
			},
			'org': {
				description: 'Specify the organization'
			},
			'product': {
				description: 'Specify the product id'
			},
			'device': {
				description: 'Specify the device id'
			},
			'dry-run': {
				description: 'Preview what would be deleted without actually deleting',
				boolean: true
			},
		},
		handler: (args) => {
			const EnvVarsCommand = require('../cmd/env');
			return new EnvVarsCommand(args).deleteEnv(args);
		},
		examples: {
			'$0 $command <key> --sandbox': 'Delete env var from user\'s sandbox',
			'$0 $command <key> --org <org>': 'Delete env var from an organization',
			'$0 $command <key> --product <productId>': 'Delete env var from a product',
			'$0 $command <key> --device <deviceId>': 'Delete env var from a device',
			'$0 $command <key> --sandbox --dry-run': 'Preview deletion without actually deleting',
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
