
export default ({ commandProcessor, root, app }) => {
	commandProcessor.createCommand(root, 'help', false, {
		options: {},
		params: '[command...]',
		handler: function helpHandler(argv) {
			let cmd = argv.params.command;
			cmd.push('--help');

			return app.runCommand(cmd);
		}
	});
};
