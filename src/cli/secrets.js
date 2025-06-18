const os = require('os');

module.exports = ({ commandProcessor, root }) => {
	const secrets = commandProcessor.createCategory(root, 'secrets', 'create, update, list and remove secrets', { alias: 'sc' });
	const aliasDescription = 'Alias: this command can be also executed as sc';

	commandProcessor.createCommand(secrets, 'list', `List all created secrets. ${os.EOL}${aliasDescription} list[options]`, {
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

	commandProcessor.createCommand(secrets, 'get', 'Get an specific secret',{
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

	commandProcessor.createCommand(secrets, 'create', 'Creates a new secret', {
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

	commandProcessor.createCommand(secrets, 'update', 'Updates the value of an existing secret', {
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

	commandProcessor.createCommand(secrets, 'remove', 'Remove an specific secret',{
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
