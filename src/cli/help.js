module.exports = ({ commandProcessor, root, app }) => {
	commandProcessor.createCommand(root, 'help', false, {
		params: '[command...]',
		handler: (argv) => {
			let cmd = argv.params.command;
			cmd.push('--help');

			return app.runCommand(cmd);
		}
	});
};
