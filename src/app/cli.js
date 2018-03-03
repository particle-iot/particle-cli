import tty from 'tty';
import _ from 'lodash';

import updateCheck from './update-check';
import pkg from '../../package.json';
import * as commandProcessor from './command-processor';
import registerAllCommands from '../cli';
import * as settings from '../../settings';
import when from 'when';
import chalk from 'chalk';
import log from '../lib/log';
import process from 'process';

export default class CLI {
	constructor() {
		//process.on('unhandledRejection', this.globalRejectionHandler.bind(this));
		this.rootCategory = this.setupCommandProcessor();
	}

	globalRejectionHandler(reason, promise) {
		log.fatal(reason);
		process.exit(-1);
	}

	setupCommandProcessor(includeOldCommands = false) {
		const app = this;

		return commandProcessor.createAppCategory({
			// options for yargs
			inherited: {
				options: {
					/*
					args: {
						config: true
					},
					*/
					v: {
						alias: 'verbose',
						count: true,
						description: 'Increases how much logging to display'
					},
					q: {
						alias: 'quiet',
						count: true,
						description: 'Decreases how much logging to display'
					},
					/*
					 interactive: {
					 boolean: true,
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
					 */
				}
			},

			options: {
				version: {
					boolean: true,
					description: 'Show the version of particle-cli installed.'
				}
			},

			epilogue: 'For more information, visit our documentation at https://docs.particle.io\n\nparticle-cli ' + pkg.version,

			version: app.showVersion,

			/**
			 * Setup global attributes from the parsed arguments.
			 * @param {*} yargs The yargs parser to setup
			 * @param {CLIRootCommandCategory} root The root command category to setup.
			 */
			setup(yargs, root) {
				registerAllCommands({ commandProcessor, root, app });
				if (includeOldCommands) {
					app.addOldCommands(yargs);
				}
				app.addGlobalOptions(yargs);
				_.each(root.commands, command => app.addGlobalSetup(command));
			},

			/**
			 * Set up the global state from the initial command parsing.
			 * @param {*} argv The parsed command line arguments.
			 */
			parsed(argv) {
				global.isInteractive = argv.interactive === true || (tty.isatty(process.stdin) && !argv.nonInteractive);
				global.verboseLevel = argv.verbose+1-argv.quiet;
				global.outputJson = argv.json;
			}
		});
	}

	/**
	 * Adds the old commands so they are displayed in the help system
	 * @param {Yargs} yargs the yargs instance to receive all the old style command definitions.
	 */
	addOldCommands(yargs) {
		const cli = this.oldInterpreter();

		function builder(yargs) {
			return yargs;
		}

		const commands = cli.getCommands();
		for (let i = 0; i < commands.length; i++) {
			try {
				const c = commands[i];
				if (c.name !== null) {
					yargs.command(c.name, c.description, builder);
				}
			} catch (ex) {
				console.error('Error loading command ' + ex);
			}
		}
	}

	addGlobalSetup(cat) {
		if (!cat.options.setup) {
			cat.options.setup = this.addGlobalOptions.bind(this);
		} else {
			const oldFunc = cat.options.setup;
			cat.options.setup = (yargs) => {
				oldFunc(yargs);
				this.addGlobalSetup(yargs);
			};
		}
		_.each(cat.commands, command => this.addGlobalSetup(command));
	}

	addGlobalOptions(yargs) {
		// the options are added by each subcommand, so we just
		// todo - if a command overrides an option, then it should not be set as a global option.
		// This is probably best moved into the yargs-parser.js module
		_.each(this.rootCategory.options.inherited.options, (opt, name) => {
			yargs.group(name, 'Global Options:');
		});
	}

	newrun(args) {
		return this.runCommand(args, false);
	}

	runCommand(args, includeOldCommands) {
		const errors = commandProcessor.createErrorHandler();
		this.rootCategory = this.setupCommandProcessor(includeOldCommands);
		const argv = commandProcessor.parse(this.rootCategory, args);
		// we want to separate execution from parsing, but yargs wants to execute help/version when parsing args.
		// this also gives us more control.
		// todo - handle root command passing --version
		if (argv.help) {
			commandProcessor.showHelp();
		} else if (argv.clierror) {
			errors(argv.clierror);
		} else if (argv.clicommand) {
			when(argv.clicommand.exec(argv)).done(result => result, errors);
		}
	}

	isNewCommand(args) {
		if (args.length === 0 || args[0] === 'help') {
			// FIXME: use old help
			return false;
		}
		const argv = commandProcessor.parse(this.rootCategory, args);
		return this.checkNewCommand(argv);
	}

	showHelp(cmdline) {

	}

	showVersion(exit=true) {
		console.log(pkg.version);
		process.exit();
	}

	checkNewCommand(argv) {
		const result = argv.help
			|| argv.clicommand
			|| (argv.clierror
			&& argv.clierror.type   // has an parsing error
			&& (
			argv.clierror.type === commandProcessor.errors.requiredParameterError
			|| argv.clierror.type === commandProcessor.errors.unknownArgumentError
			|| argv.clierror.type === commandProcessor.errors.unknownParametersError
			|| (argv.clierror.type === commandProcessor.errors.unknownCommandError) && (argv.clierror.item.path.length > 0)));
		return !!result;
	}

	oldInterpreter() {
		const Interpreter = require('../lib/interpreter');
		const cli = new Interpreter();
		cli.supressWarmupMessages = true;
		cli.startup();
		return cli;
	}

	oldrun(args) {
		const cli = this.oldInterpreter();
		cli.handle(args, true);
	}

	hasArg(name, args) {
		const index = args.indexOf(name);
		if (index >= 0) {
			args.splice(index, 1);
			return true;
		}
		return false;
	}

	loadNativeModules(modules) {
		let errors = [];
		for (let module of modules) {
			try {
				require(module);
			} catch (err) {
				errors.push(`Error loading module '${module}': ${err.message}`);
			}
		}
		return errors;
	}

	run(args) {
		settings.whichProfile();
		settings.loadOverrides();

		const nativeErrors = this.loadNativeModules(settings.nativeModules);
		if (nativeErrors.length) {
			for (let error of nativeErrors) {
				log.error(error);
			}
			log.fatal(`Please reinstall the CLI again using ${chalk.bold('npm install -g particle-cli')}`);
			return;
		}

		settings.disableUpdateCheck = this.hasArg('--no-update-check', args);
		const force = this.hasArg('--force-update-check', args);

		return updateCheck(settings.disableUpdateCheck, force).then(() => {
			const cmdargs = args.slice(2);       // remove executable and script
			let promise;
			if (this.isNewCommand(cmdargs)) {
				promise = this.newrun(cmdargs);
			} else {
				promise = this.oldrun(args);
			}
			return promise;
		}).catch(commandProcessor.createErrorHandler());
	}
}


