import yargs from 'yargs';

export default (app, cli) => {
	cli.createCommand(app, 'help', 'Provides extra details and options for a given command', {
		options: {},
		handler: function helpHandler(argv) {
			const cmd = argv._.slice(1);
			cmd.push('--help');
			yargs(cmd);
			cli.run(app, yargs);
		}
	});
};
