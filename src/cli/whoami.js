export default ({ commandProcessor, root, app }) => {
	commandProcessor.createCommand(root, 'whoami', 'prints signed-in username', {
		handler: (args) => {
			const WhoAmICommand = require('../cmd/whoami');
			return new WhoAmICommand().getUsername();
		}
	});
};

