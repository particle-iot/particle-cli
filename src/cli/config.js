'use strict';

module.exports = ({ commandProcessor, root }) => {
	const config = commandProcessor.createCategory(root, 'config', 'Manage environment variables and secrets', {
		epilogue: 'Note: the commands to manage profiles have been renamed from `particle config` to `particle profile`. Run `particle help profile` for details.'
	});

	const env = commandProcessor.createCategory(config, 'env', 'Manage environment variables', {
		inherited: {
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
				}
			}
		}
	});

	commandProcessor.createCommand(env, 'list', 'List all environment variables', {
		options: {
			'json': {
				description: 'Show the list in json format',
				boolean: true
			}
		},
		handler: (args) => {
			const EnvCommands = require('../cmd/env');
			return new EnvCommands(args).list(args);
		},
		examples: {
			'$0 $command --sandbox': 'List all environment variables from sandbox',
			'$0 $command --org <org>': 'List all environment variables from a specific organization',
			'$0 $command --product <productId>': 'List all environment variables from a specific product',
			'$0 $command --device <deviceId>': 'List all environment variables from a specific device',
		}
	});

	commandProcessor.createCommand(env, 'set', 'Set an environment variable', {
		params: '<name> [value]',
		handler: (args) => {
			const EnvCommands = require('../cmd/env');
			return new EnvCommands(args).setEnv(args);
		},
		examples: {
			'$0 $command <name> <value> --sandbox': 'Set env var to user\'s sandbox (space format)',
			'$0 $command <name=value> --sandbox': 'Set env var to user\'s sandbox (equal sign format)',
			'$0 $command <name> <value> --org <org>': 'Set env var for an organization',
			'$0 $command <name=value> --product <productId>': 'Set env var for a product',
			'$0 $command <name> <value> --device <deviceId>': 'Set env var for a device',
		}
	});

	commandProcessor.createCommand(env, 'delete', 'Delete an environment variable', {
		params: '<name>',
		handler: (args) => {
			const EnvCommands = require('../cmd/env');
			return new EnvCommands(args).deleteEnv(args);
		},
		examples: {
			'$0 $command <name> --sandbox': 'Delete env var from user\'s sandbox',
			'$0 $command <name> --org <org>': 'Delete env var from an organization',
			'$0 $command <name> --product <productId>': 'Delete env var from a product',
			'$0 $command <name> --device <deviceId>': 'Delete env var from a device',
		}
	});

	const secret = commandProcessor.createCategory(config, 'secrets', 'Manage secrets', {
		inherited: {
			options: {
				'sandbox': {
					description: 'Target the sandbox',
					boolean: true
				},
				'org': {
					description: 'Specify the organization'
				}
			}
		}
	});

	commandProcessor.createCommand(secret, 'list', 'List all created secrets', {
		options: {
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
			'$0 $command --sandbox': 'List all secrets from sandbox',
			'$0 $command --org <org>': 'List all secrets from a specific organization'
		}
	});

	commandProcessor.createCommand(secret, 'get', 'Get a specific secret',{
		params: '<name>',
		handler: (args) => {
			const SecretsCommand = require('../cmd/secrets');
			return new SecretsCommand(args).get(args);
		},
		examples: {
			'$0 $command <name> --sandbox': 'Get a secret from sandbox',
			'$0 $command <name> --org <org>': 'Get a secret from a specific organization'
		}
	});

	commandProcessor.createCommand(secret, 'set', 'Set a secret', {
		params: '<name> [value]',
		handler: (args) => {
			const SecretsCommand = require('../cmd/secrets');
			return new SecretsCommand(args).set(args);
		},
		examples: {
			'$0 $command <name> <value> --sandbox': 'Set secret to user\'s sandbox (space format)',
			'$0 $command <name=value> --sandbox': 'Set secret to user\'s sandbox (equal sign format)',
			'$0 $command <name> <value> --org <org>': 'Set secret for an organization',
			'$0 $command <name=value> --org <org>': 'Set secret for an organization (equal sign format)'
		}
	});

	commandProcessor.createCommand(secret, 'delete', 'Delete a specific secret',{
		params: '<name>',
		handler: (args) => {
			const SecretsCommand = require('../cmd/secrets');
			return new SecretsCommand(args).deleteSecret(args);
		},
		examples: {
			'$0 $command <name> --sandbox': 'Delete a secret from sandbox',
			'$0 $command <name> --org <org>': 'Delete a secret from a specific organization'
		}
	});
};
