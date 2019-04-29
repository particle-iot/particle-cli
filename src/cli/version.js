module.exports = ({ commandProcessor, root, app }) => {
	commandProcessor.createCommand(root, 'version', false, {
		handler: () => app.runCommand(['--version']),
	});
};

