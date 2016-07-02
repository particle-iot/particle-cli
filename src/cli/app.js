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
		},
		'help': {
			boolean: true,
			description: 'Provides extra details and options for a given command'
		},
		'version': {
			boolean: true,
			description: 'Show version number'
		}
	},
	epilogue: 'For more information, visit our documentation at https://docs.particle.io\n\nparticle-cli ' + pkg.version,

	/**
	 * Setup global attributes from the parsed arguments.
	 * @param {*} yargs The yargs parser to setup
	 */
	setup(yargs) {
		commands(app, cli);
		_.each(app.commands, addGlobalSetup);
	},

	/**
	 * Set up the global state from the initial command parsing.
	 * @param {*} argv The parsed command line arguments.
	 */
	parsed(argv) {
		global.isInteractive = tty.isatty(process.stdin) && !argv.nonInteractive;
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

export default {

	newrun(args) {
		updateCheck().then(() => {
			const errors = cli.createErrorHandler();
			const argv = cli.parse(app, args.slice(2));
			// we want to separate execution from parsing, but yargs wants to execute help/version when parsing args.
			// this also gives us more control.
			if (argv.help) {
				cli.showHelp();
			} else if (argv.version) {
				console.log(pkg.version);
			} else if (argv.clierror) {
				errors(argv.clierror);
			} else if (argv.clicommand) {
				argv.clicommand.exec(argv, errors);
			}
		});
	},

	isNewCommand(args) {
		args = args.slice(2);       // remove executable and script
		if (args.length===0 || args[0]==='help') {
			// use old help for now
			return false;
		}
		const argv = cli.parse(app, args);
		const result = argv.help || (argv.clicommand && (!argv.clierror || argv.clierror.type!==cli.errors.unknownCommandError) );
		return result;
	},

	oldrun(args) {
		const Interpreter = require('../../oldlib/interpreter');
		const cli = new Interpreter();
		cli.supressWarmupMessages = true;
		cli.startup();
		cli.handle(args, true);
	},

	run(args) {
		updateCheck().then(() => {
			if (this.isNewCommand(args)) {
				this.newrun(args);
			} else {
				this.oldrun(args);
			}
		});
	}
};
