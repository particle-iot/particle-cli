
export default ({root, factory, app}) => {
	factory.createCommand(root, 'help', 'Provides extra details and options for a given command', {
		options: {},
		params: '[command] [subcommand...]',
		handler: function helpHandler(argv) {
			// todo - remove `help` wherever it appears in the command line - it may not be the first one
			let cmd = argv._;
			cmd = cmd.slice(1);
			cmd = cmd.concat(argv.params.command || []);
			cmd.push('--help');

			return app.runCommand(cmd, true);
		}
	});
};
