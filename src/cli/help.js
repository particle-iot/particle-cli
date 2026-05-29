'use strict';
module.exports = ({ commandProcessor, root, app }) => {
	commandProcessor.createCommand(root, 'help', false, {
		params: '[command...]',
		handler: (argv) => {
			const cmd = argv.params.command;
			cmd.push('--help');

			return app.runCommand(cmd);
		}
	});
};
