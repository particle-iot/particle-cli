'use strict';
module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'whoami', 'prints signed-in username', {
		authRequired: true,
		handler: () => {
			const WhoAmICommand = require('../cmd/whoami');
			return new WhoAmICommand().getUsername();
		}
	});
};

