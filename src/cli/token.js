module.exports = ({ commandProcessor, root }) => {
	const token = commandProcessor.createCategory(root, 'token', 'Manage access tokens (require username/password)');

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
			return new AccessTokenCommands().revokeAccessToken(args.params.tokens, args);
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

