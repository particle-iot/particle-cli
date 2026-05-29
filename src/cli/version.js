'use strict';
module.exports = ({ commandProcessor, root, app }) => {
	commandProcessor.createCommand(root, 'version', false, {
		verifyTokenFreshness: false,
		handler: () => app.runCommand(['--version']),
	});
};

