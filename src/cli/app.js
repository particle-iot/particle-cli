import tty from 'tty';
import _ from 'lodash';

import updateCheck from './update-check';
import pkg from '../../package';
import * as cli from './nested-yargs';
import commands from '../cmd';

const app = cli.createApp({
	options: {
		args: {
			config: true
		},
		v: {
			alias: 'verbose',
			count: true,
			description: 'How much logging to display'
		},
		'non-interactive': {
			boolean: true,
			description: 'Run in non-interactive mode. This means all required data must be passed as command line arguments.'
		}
	},
	version: pkg.version,
	epilogue: 'For more information, visit our documentation at https://docs.particle.io\n\nparticle-cli ' + pkg.version,
	setup: yargs => {
		global.isInteractive = tty.isatty(process.stdin) && !yargs.argv.nonInteractive;
		global.verboseLevel = yargs.argv.verbose;
		commands(app, cli);
		_.each(app.commands, addGlobalSetup);
	}
});

function addGlobalSetup(cat) {
	cat.options.setup = addGlobalOptions;
	_.each(cat.commands, addGlobalSetup);
}

function addGlobalOptions(yargs) {
	_.each(app.options.options, function addGlobalOption(opt, name) {
		yargs.option(name, opt);
	});
}

export default {
	run() {
		updateCheck().then(() => {
			cli.run(app);
		});
	}
};
