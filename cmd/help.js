'use strict';

module.exports = function helpCommands(app, cli) {
	var help = cli.createCommand('help', 'Provides extra details and options for a given command', {
		options: {},
		handler: function (argv) {
			var yargs = require('yargs');
			var cmd = argv._.slice(1);
			cmd.push('--help');
			yargs(cmd);
			cli.run(app, yargs);
		}
	});
	app.command(help);
};
