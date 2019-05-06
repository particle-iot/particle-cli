module.exports = ({ commandProcessor, root }) => {
	const token = commandProcessor.createCategory(root, 'token', 'Manage access tokens (require username/password)');

	commandProcessor.createCommand(token, 'list', 'List all access tokens for your account', {
		handler: () => {
			const AccessTokenCommands = require('../cmd/token');
			return new AccessTokenCommands().listAccessTokens();
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
			return new AccessTokenCommands().revokeAccessToken(args.params.tokens, args);
		}
	});

	commandProcessor.createCommand(token, 'create', 'Create a new access token', {
		handler: () => {
			const AccessTokenCommands = require('../cmd/token');
			return new AccessTokenCommands().createAccessToken();
		}
	});

	return token;
};

