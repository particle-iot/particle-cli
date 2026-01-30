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
		params: '<key> [value]',
		handler: (args) => {
			const EnvCommands = require('../cmd/env');
			return new EnvCommands(args).setEnvVars(args);
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
			'dry-run': {
				description: 'Preview what would be deleted without actually deleting',
				boolean: true
			},
		},
		handler: (args) => {
			const EnvCommands = require('../cmd/env');
			return new EnvCommands(args).deleteEnv(args);
		},
		examples: {
			'$0 $command <key> --sandbox': 'Delete env var from user\'s sandbox',
			'$0 $command <key> --org <org>': 'Delete env var from an organization',
			'$0 $command <key> --product <productId>': 'Delete env var from a product',
			'$0 $command <key> --device <deviceId>': 'Delete env var from a device',
			'$0 $command <key> --sandbox --dry-run': 'Preview deletion without actually deleting',
		}
	});

	commandProcessor.createCommand(env, 'rollout', 'Apply environment variable changes to devices', {
		options: {
			'yes': {
				description: 'Skip confirmation prompts',
				boolean: true
			},
			'when': {
				description: 'When to apply the rollout (Immediate or Connect)',
				choices: ['Immediate', 'Connect']
			}
		},
		handler: (args) => {
			const EnvCommands = require('../cmd/env');
			return new EnvCommands(args).rollout(args);
		},
		examples: {
			'$0 $command --sandbox': 'Rollout env var changes to sandbox',
			'$0 $command --org <org>': 'Rollout env var changes to an organization',
			'$0 $command --product <productId>': 'Rollout env var changes to a product',
			'$0 $command --device <deviceId>': 'Rollout env var changes to a device',
			'$0 $command --sandbox --yes': 'Rollout without confirmation prompts',
			'$0 $command --sandbox --when Immediate': 'Apply rollout immediately',
		}
	});

	const secret = commandProcessor.createCategory(config, 'secrets', 'Manage secrets');

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
			'$0 $command --org <org>': 'List all secrets from a specific org'
		}
	});

	commandProcessor.createCommand(secret, 'get', 'Get a specific secret',{
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

	commandProcessor.createCommand(secret, 'remove', 'Remove a specific secret',{
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
