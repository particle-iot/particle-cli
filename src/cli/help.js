
export default ({root, factory, app}) => {
	factory.createCommand(root, 'help', 'Provides extra details and options for a given command', {
		options: {},
		params: "[command] [subcommand...]",
		handler: function helpHandler(argv) {
		    // todo - remove `help` wherever it appears in the command line - it may not be the first one
			const cmd = argv._.slice(1);
			cmd.push('--help');
			return app.runCommand(cmd);
		}
	});
};