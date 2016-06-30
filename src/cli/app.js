import tty from 'tty';
import _ from 'lodash';

import updateCheck from './update-check';
import pkg from '../../package.json';
import * as cli from './nested-yargs';
import commands from '../cmd';

const app = cli.createAppCategory({
	// options for yargs
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
		},
		'json': {
			boolean: true,
			description: 'Output in JSON format instead of human friendly'
		}
	},
	version: pkg.version,
	epilogue: 'For more information, visit our documentation at https://docs.particle.io\n\nparticle-cli ' + pkg.version,

	/**
	 * Setup global attributes from the parsed arguments.
	 * @param yargs
	 */
	setup(yargs) {
		commands(app, cli);
		_.each(app.commands, addGlobalSetup);
	},

	/**
	 * Set up the global state from the initial command parsing. 
	 * @param yargs
	 */
	parsed(yargs) {
		global.isInteractive = tty.isatty(process.stdin) && !yargs.argv.nonInteractive;
		global.verboseLevel = global.verboseLevel + yargs.argv.verbose;
		global.outputJson = yargs.argv.json;
	}
});

function addGlobalSetup(cat) {
	if (!cat.options.setup) {
		cat.options.setup = addGlobalOptions;
	} else {
		const oldFunc = cat.options.setup;
		cat.options.setup = (yargs) => {
			oldFunc(yargs);
			addGlobalSetup(yargs);
		};
	}
	_.each(cat.commands, addGlobalSetup);
}

function addGlobalOptions(yargs) {
	_.each(app.options.options, function addGlobalOption(opt, name) {
		yargs.option(name, opt).group(name, 'Global Options:');
	});
	yargs.group('help', 'Global Options:');
}

export default {

	newrun(args) {
		updateCheck().then(() => {
		 	cli.run(app, args.slice(2));
		});
	},

	oldrun(args) {
		const Interpreter = require('../../oldlib/interpreter');
		const cli = new Interpreter();
		cli.supressWarmupMessages = true;
		cli.startup();
		cli.handle(args, true);
	},

	run(args) {
		this.newrun(args);
	}
};
