import tty from 'tty';
import _ from 'lodash';

import updateCheck from './update-check';
import pkg from '../../package.json';
import * as cliargs from './nested-yargs';
import commands from '../cli';
import * as settings from '../../settings';
import when from 'when';


const app = cliargs.createAppCategory({
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
		interactive: {
			boolean:true,
			description: 'forces interactive mode'
		},
		'non-interactive': {
			boolean: true,
			description: 'Run in non-interactive mode. This means all required data must be passed as command line arguments.'
		},
		'json': {
			boolean: true,
			description: 'Output in JSON format instead of human friendly'
		},
		'help': {
			boolean: true,
			description: 'Provides extra details and options for a given command'
		},
	},
	epilogue: 'For more information, visit our documentation at https://docs.particle.io\n\nparticle-cli ' + pkg.version,

	/**
	 * Setup global attributes from the parsed arguments.
	 * @param {*} yargs The yargs parser to setup
	 */
	setup(yargs) {
		commands(app, cliargs);
		_.each(app.commands, addGlobalSetup);
	},

	/**
	 * Set up the global state from the initial command parsing.
	 * @param {*} argv The parsed command line arguments.
	 */
	parsed(argv) {
		global.isInteractive = argv.interactive===true || (tty.isatty(process.stdin) && !argv.nonInteractive);
		global.verboseLevel = global.verboseLevel + argv.verbose;
		global.outputJson = argv.json;
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

export class CLI {
	newrun(args) {
		return Promise.resolve().then(() => {
			const errors = cliargs.createErrorHandler();
			const argv = cliargs.parse(app, args);
			// we want to separate execution from parsing, but yargs wants to execute help/version when parsing args.
			// this also gives us more control.
			// todo - handle root command passing --version
			if (argv.help) {
				cliargs.showHelp();
			} else if (argv.clierror) {
				errors(argv.clierror);
			} else if (argv.clicommand) {
				when(argv.clicommand.exec(argv)).done(result => result, errors);
			}
		});
	}

	isNewCommand(args) {
		if (args.length===0 || args[0]==='help') {
			// use old help for now
			return false;
		}
		const argv = cliargs.parse(app, args);
		return this.checkNewCommand(argv);
	}

	checkNewCommand(argv) {
		const result = argv.help || argv.clicommand || (argv.clierror.type===cliargs.errors.unknownCommandError && (argv.clierror.item.path.length > 0));
		return !!result;
	}

	oldrun(args) {
		const Interpreter = require('../../oldlib/interpreter');
		const cli = new Interpreter();
		cli.supressWarmupMessages = true;
		cli.startup();
		cli.handle(args, true);
	}

	run(args) {
		settings.transitionSparkProfiles();
		settings.whichProfile();
		settings.loadOverrides();

		updateCheck().then(() => {
			const cmdargs = args.slice(2);       // remove executable and script
			let promise;
			if (this.isNewCommand(cmdargs)) {
				promise = this.newrun(cmdargs);
			} else {
				promise = this.oldrun(args);
			}
			return promise;
		});
	}
}

export default {
	run(args) {
		return new CLI().run(args);
	}
};


