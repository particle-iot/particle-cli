const _ = require('lodash');
const log = require('../lib/log');
const pkg = require('../../package.json');
const settings = require('../../settings');
const unindent = require('../lib/unindent');
const registerAllCommands = require('../cli');
const updateCheck = require('./update-check');
const commandProcessor = require('./command-processor');


module.exports = class CLI {
	constructor() {
		//process.on('unhandledRejection', this.globalRejectionHandler.bind(this));
		this.rootCategory = this.setupCommandProcessor();
	}

	globalRejectionHandler(reason) {
		log.fatal(reason);
		process.exit(-1);
	}

	setupCommandProcessor() {
		const app = this;

		return commandProcessor.createAppCategory({
			description: unindent(`
				Welcome to the Particle Command Line Interface!
				Version ${pkg.version}
				https://github.com/particle-iot/particle-cli
				
			`),

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

			examples: {
				'$0 setup': 'Set up your Particle account and your device',
				'$0 list': 'Show all your devices and their functions and variables',
				'$0 flash my_device tinker': 'Remotely update your device to run the default Tinker app',
				'$0 call my_device_name digitalwrite D7=HIGH': 'Call a function on your device running Tinker to toggle the onboard LED'
			},

			epilogue: 'For more information, visit our documentation at https://docs.particle.io',

			version: app.showVersion,

			/**
			 * Setup global attributes from the parsed arguments.
			 * @param {*} yargs The yargs parser to setup
			 * @param {CLIRootCommandCategory} root The root command category to setup.
			 */
			setup(yargs, root) {
				registerAllCommands({ commandProcessor, root, app });
				app.addGlobalOptions(yargs);
				_.each(root.commands, command => app.addGlobalSetup(command));
			},

			/**
			 * Set up the global state from the initial command parsing.
			 * @param {*} argv The parsed command line arguments.
			 */
			parsed(argv) {
				global.isInteractive = argv.interactive === true || (process.stdin.isTTY && !argv.nonInteractive);
				global.verboseLevel = argv.verbose+1-argv.quiet;
				global.outputJson = argv.json;
			}
		});
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
		// This is probably best moved into the command-processor.js module
		_.each(this.rootCategory.options.inherited.options, (opt, name) => {
			yargs.group(name, 'Global Options:');
		});
	}

	async runCommand(args){
		let argv;

		this.rootCategory = this.setupCommandProcessor();

		try {
			argv = commandProcessor.parse(this.rootCategory, args);
		} catch (error){
			error.isUsageError = true;
			throw error;
		}

		if (argv.help){
			commandProcessor.showHelp();
		} else if (argv.clierror){
			throw argv.clierror;
		} else if (argv.clicommand){
			await argv.clicommand.exec(argv);
		}
	}

	showVersion() {
		console.log(pkg.version);
		process.exit();
	}

	hasArg(name, args) {
		const index = args.indexOf(name);
		if (index >= 0) {
			args.splice(index, 1);
			return true;
		}
		return false;
	}

	async run(args){
		settings.whichProfile();
		settings.loadOverrides();
		settings.disableUpdateCheck = this.hasArg('--no-update-check', args);
		const force = this.hasArg('--force-update-check', args);

		try {
			await updateCheck(settings.disableUpdateCheck, force);
			const cmdargs = args.slice(2); // remove executable and script
			return await this.runCommand(cmdargs);
		} catch (error){
			const onError = commandProcessor.createErrorHandler();
			return onError(error);
		}
	}
};

