module.exports = ({ commandProcessor, root }) => {
	const token = commandProcessor.createCategory(root, 'token', 'Manage access tokens (require username/password)');

	commandProcessor.createCommand(token, 'list', 'List all access tokens for your account', {
		handler: (args) => {
			const AccessTokenCommands = require('../cmd/token');
			return new AccessTokenCommands().listAccessTokens(args);
		}
	});

	commandProcessor.createCommand(token, 'revoke', 'Revoke an access token', {
		params: '<tokens...>',
		options: {
			'force': {
				boolean: true,
				description: 'Force deleting access token used by this CLI'
			}
		},
		handler: (args) => {
			const AccessTokenCommands = require('../cmd/token');
			return new AccessTokenCommands().revokeAccessToken(args);
		},
		examples: {
			'$0 $command 1234': 'Revoke your access token `1234`',
			'$0 $command 1234 5678': 'Revoke your access tokens `1234` and `5678`',
			'$0 $command 1234 --force': 'Revoke your access token `1234` even if it is currently used by this CLI',
			'$0 $command all': 'Revoke all of your access tokens',
		}
	});

	commandProcessor.createCommand(token, 'create', 'Create a new access token', {
		options: {
			'expires-in': {
				description: 'Create a token valid for this many seconds. When omitted, the Particle API assigns a default expiration.',
				number: true
			},
			'never-expires': {
				description: "Create a token that doesn't expire. Useful for a token that will be used by a cloud application for making Particle API requests.",
				boolean: true
			},
		},
		handler: (args) => {
			const AccessTokenCommands = require('../cmd/token');
			return new AccessTokenCommands().createAccessToken({ expiresIn: args['expires-in'], neverExpires: args['never-expires'] });
		}
	});

	return token;
};

