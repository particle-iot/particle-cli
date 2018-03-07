export default ({ commandProcessor, root }) => {
	const token = commandProcessor.createCategory(root, 'token', 'Manage access tokens (require username/password)');

	commandProcessor.createCommand(token, 'list', 'List all access tokens for your account', {
		handler: (args) => {
			const AccessTokenCommands = require('../cmd/token');
			return new AccessTokenCommands(args).listAccessTokens();
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
			return new AccessTokenCommands(args).revokeAccessToken();
		}
	});

	commandProcessor.createCommand(token, 'create', 'Create a new access token', {
		handler: (args) => {
			const AccessTokenCommands = require('../cmd/token');
			return new AccessTokenCommands(args).createAccessToken();
		}
	});

	return token;
};
