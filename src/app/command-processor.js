/**
 * Builds the command line parser based on yargs.
 *
 * The commands are arranged as a hierarchy, with the root representing invocation with no commands, children
 * under the root as the first level of commands, their children are 2nd level commands and so on.
 *
 * The immediate child commands of the root are built via the `setup()` callback on the root command configuration,
 * after `run()` is called on the root command. At this point, the command line has not yet been parsed.
 *
 * Once the first set of commands have been built, the parser is ran. If the command line matches one of the commands,
 * the `run()` method for the command is invoked. This registers options, help text, examples and subcommands under
 * the first level and the command string parsed again, causing subsequent nested commands to be registered and parsed.
 *
 * The first parser handles the top-level command, the next level handles sub-commands
 * of the top level and so on.
 * With each level, the yargs parser is augmented with new commands, options and parameters.
 *
 */
const _ = require('lodash');
const path = require('path');
const util = require('util');
const chalk = require('chalk');
const VError = require('verror');
const yargsFactory = require('yargs/yargs');

// It's important to run yargs in the directory of the script so it picks up options from package.json
const Yargs = yargsFactory(process.argv.slice(2), path.resolve(__dirname, '../..'));
Yargs.$0 = 'particle';

class CLICommandItem {

	/**
	 * Constructor.
	 * @param {string} name             The name of the command. This is the text the command is recognized by.
	 * @param {string} description      A description of the command. Used to print help text / error messages.
	 * @param {object} options - options for yargs processing. it has these defined attributes:
	 *  - options: the options to pass to yargs
	 *  - setup: a function called with yargs to allow additional setup of the command line parsing
	 *  - examples: an object of examples to add to yargs (key is the command, value is the description)
	 *  - version: the version function to pass to yargs
	 */
	constructor(name, description = '', options = {}) {
		if (!name) {
			throw Error('name must be defined');
		}
		this.commands = {};
		this.aliases = [];
		description = description!==undefined ? description : '';
		Object.assign(this, { name, description, options, inherited: options.inherited });
	}

	/**
	 * Retrieves the sequence of words used to reach this command.
	 * In cases where a command has an alias, this returns the canonical form of the command.
	 * @returns {Array<String>} The command path as an array of simple names.
	 */
	get path() {
		return this.parent
			? this.parent.path.concat([this.name])
			: [this.name];
	}

	/**
	 * Fetches a subitem from this item.
	 * @param {string} name  The name of the sub item to retrieve.
	 * @returns {CLICommandItem} A command item matching the name, or `undefined` if the named item doesn't exist.
	 */
	item(name) {
		return this.commands[name];
	}

	/**
	 * Finds the command at the given path.
	 * @param {Array<string>} path  The command path to find from this command
	 * @returns {CliCommandItem}  the item found at the path or undefined
	 */
	find(path) {
		if (!path || !path.length) {
			return this;
		}
		const name = path[0];
		const remain = path.slice(1);
		const cmd = this.item(name);
		return cmd && cmd.find(remain);
	}

	/**
	 * Adds a command item at this point in the command tree.
	 * @param {CLICommandItem} item     the command to add.
	 * @returns {CLICommandItem} this
	 */
	addItem(item) {
		this.commands[item.name] = item;
		item.parent = this;
		return this;
	}

	/**
	 * Configures the yargs parser for this command.
	 * @private
	 * @param {yargs} yargs         the yargs instance to configure
	 * @param {object} options      yargs options
	 * @param {function(yargs)} setup     a function to call after setting the options
	 * @param {Array} examples      yargs examples
	 * @param {function} version    A function to retrieve the version
	 * @param {string} epilogue     Printed at the end of the command block.
	 */
	configure(yargs, { options, setup, examples, version, epilogue }=this.buildOptions()) {
		if (options) {
			this.fetchAliases(options);
			this.configureOptions(options);
			// avoid converting positional arguments to numbers by default
			const optionsWithDefaults = Object.assign({ '_': { string: true	} }, options);
			yargs.options(optionsWithDefaults);
		}

		if (setup) {
			setup(yargs, this);
		}

		if (examples) {
			const command = this.path.join(' ');
			Object.keys(examples).forEach(cmd => {
				yargs.example(cmd.replace(/\$command/, command), examples[cmd]);
			});
		}

		if (version) {
			this.version = version;
		}

		if (epilogue) {
			yargs.epilogue(epilogue);
		}

		yargs.exitProcess(false);
	}

	fetchAliases(options) {
		Object.keys(options).forEach((key) => {
			const option = options[key];
			const alias = option.alias;
			if (alias) {
				this.aliases[alias] = key;
			}
		});
	}

	configureOptions(options) {
		Object.keys(options).forEach((key) => {
			const option = options[key];
			if (!option.hasOwnProperty('nargs') &&
				!option.boolean &&
				!option.count &&
				!option.array) {
				option.nargs = 1;
			}

			if (!option.hasOwnProperty('number') &&
				!option.hasOwnProperty('boolean') &&
				!option.hasOwnProperty('string') &&
				!option.hasOwnProperty('count') &&
				!option.hasOwnProperty('array')) {
				option.string = true;
			}
		});
	}

	/**
	 * Finds the original name of an option given a possible alias.
	 * @param {string} name The option name to unalias.
	 * @returns {string} The original option name
	 */
	unaliasOption(name) {
		return this.aliases[name] || (this.parent ? this.parent.unaliasOption(name) : undefined);
	}

	/**
	 * @param {Array<string>} args  The command line arguments to parse
	 * @param {object} yargs The yargs instance to use for parsing.
	 * @return {object} the results of parsing. The object has these properties:
	 *  clicommand: the CLICommandItem instance that matched
	 *  clierror: any errors produces (mutually exclusive with clicommand)
	 *  *: properties corresponding to any options specified on the command line.
	 */
	parse(args, yargs) {

		if (yargs===undefined) {
			yargs = Yargs;
		}

		let error = undefined;
		yargs.fail((msg, err) => {
			error = err || msg;
		});

		const argv = this.configureAndParse(args, yargs);
		if (!error) {
			if (this.options.parsed) {
				this.options.parsed(argv);
			}

			if (this.matches(argv)) {
				argv.clicommand = this;
			}
		} else {
			argv.clierror = error;
		}

		return argv;
	}

	configureAndParse(args, yargs) {
		this.configureParser(args, yargs);
		return yargs.parse(args);
	}

	matches(argv) {
		return this.matchesArgs(argv._);
	}

	matchesArgs(args) {
		if (!this.path.length) {
			return !args.length;
		}

		// walk the argv matching each command in sequence
		const last = args[args.length-1];
		return this.matchesName(last) && (!this.parent || this.parent.matchesArgs(args.slice(0, args.length-1)));
	}

	matchesName(name) {
		return this.name===name || (this.options.alias && this.options.alias===name);
	}

	/**
	 * Executes the given command, optionally consuming the result if an error handler is provided.
	 * @param {object} argv  The parsed arguments for the cli command.
	 * @returns {Promise} to run the comand
	 */
	exec(argv) {
		if (this.options.handler) {
			return Promise.resolve().then(() => this.options.handler(argv));
		} else if (argv.version && this.version) {
			return Promise.resolve(this.version(argv));
		} else {
			return this.showHelp();
		}
	}

	showHelp() {
		Yargs.showHelp();
	}

	addInheritedOptions(target) {
		const parent = this.parent;
		if (parent) {
			parent.addInheritedOptions(target);
		}
		this.assign(target, this.inherited);
	}

	buildOptions() {
		const target = {};
		this.addInheritedOptions(target);
		this.assign(target, this.options);
		return target;
	}

	assign(target, value) {
		if (value) {
			// this is a dirty hack! for now, only merge the options
			const options = target.options || {};
			Object.assign(target, value);
			target.options = Object.assign(options, value.options);
		}
	}
}

/**
 * Describes a container of commands, and whose path has a common prefix.
 * Uses the container pattern where child items can be further nested categories or
 * CLICommand instance.
 */
class CLICommandCategory extends CLICommandItem {
	constructor(name, description, options) {
		super(name, description, options);
		this.parent = null;
	}

	/**
	 * Checks that the given command exists.
	 * @callback
	 * @param {object} yargs The yargs parser instance for this command.
	 * @param {object} argv  the parsed yargs arguments
	 * @returns {boolean} the validity of the check.
	 */
	check(yargs, argv) {

		// ensure common prefix
		if (!this.matches(argv)) {
			throw unknownCommandError(argv._, this);
		}

		// We can't use `yargs.strict()` because it is possible that
		// `options.setup` changes the options during execution and this
		// seems to interfere with the timing for strict mode.
		// Additionally, `yargs.strict()` does not seem to handle pre-
		// negated params like `--no-run`.
		checkForUnknownArguments(yargs, argv, this);

		return true;
	}

	get commandNames() {
		return Object.keys(this.commands);
	}

	configureParser(args, yargs) {

		this.configure(yargs);

		// add the subcommands of this category
		this.commandNames.forEach((commandName) => {
			const command = this.commands[commandName];

			const builder = (yargs) => {
				return { argv: command.parse(args, yargs) };
			};

			yargs.command(command.name, command.description, builder);
			if (command.options && command.options.alias) {
				// hidden command
				yargs.command(command.options.alias, false, builder);
			}
		});

		yargs
			.usage((this.description ? this.description + '\n' : '')
				+ ['Usage: $0', ...this.path, '<command>'].join(' ') + '\n'
				+ ['Help:  $0 help', ...this.path, '<command>'].join(' '))
			.check((argv) => this.check(yargs, argv));

		return yargs;
	}
}

class CLIRootCategory extends CLICommandCategory {
	constructor(options) {
		super('$0', options && options.description, options);
	}

	get path() {
		return [];
	}

	get commandNames() {
		return super.commandNames.sort();
	}

}

class CLICommand extends CLICommandItem {
	/**
	 * @param {string} name The invocation name of the command on the command line
	 * @param {string} description Description of the command. Used to produce help text.
	 * @param {object} options  In addition to attributes defined by the base class:
 	 *  - params: the positional arguments in this format: <required> [optional] <rest...>
	 *  - handler: the function that is invoked with `this` and the parsed commandline.
	 */
	constructor(name, description, options) {
		super(name, description, _.defaultsDeep(options || {}, {
			params: '',
		}));
		this.name = name || '$0';
		this.parent = null;
	}

	configureParser(args, yargs) {

		this.configure(yargs);

		yargs
			.check((argv) => {
				// We can't use `yargs.strict()` because it is possible that
				// `options.setup` changes the options during execution and this
				// seems to interfere with the timing for strict mode.
				// Additionally, `yargs.strict()` does not seem to handle pre-
				// negated params like `--no-run`.
				checkForUnknownArguments(yargs, argv, this);

				parseParams(yargs, argv, this.path, this.options.params);

				return true;
			})
			.usage((this.description ? this.description + '\n' : '')
				+ 'Usage: $0 ' + this.path.join(' ') + ' [options]'
				+ (this.options.params ? ' ' + this.options.params : ''));

		return yargs;
	}
}

/**
 * Creates an error handler. The handler displays the error message if there is one,
 * or displays the help if there ie no error or it is a usage error.
 * @param {object} yargs
 * @returns {function(err)} the error handler function
 */
function createErrorHandler(yargs) {
	if (!yargs) {
		yargs = Yargs;
	}
	return consoleErrorLogger.bind(undefined, console, yargs, true);
}

function stringify(err) {
	return _.isString(err) ? err : util.inspect(err);
}

/**
 * Logs an error to the console given and optionally calls yargs.showHelp() if the
 * error is a usage error.
 * @param {object} console   The console to log to.
 * @param {Yargs} yargs     the yargs instance
 * @param {boolean} exit     if true, process.exit() is called.
 * @param {object} err      The error to log. If it has a `message` property, that is logged, otherwise
 *  the error is converted to a string by calling `stringify(err)`.
 */
function consoleErrorLogger(console, yargs, exit, err) {
	const usage = (!err || err.isUsageError);
	if (usage) {
		yargs.showHelp();
	}

	if (err) {
		console.log(chalk.red(err.message || stringify(err)));
	}
	if (!usage && (err.stack && ((global.verboseLevel || 0)>1))) {
		console.log(VError.fullStack(err));
	}
	// todo - try to find a more controllable way to singal an error - this isn't easily testable.
	if (exit) {
		process.exit(1);
	}
}

// Adapted from: https://github.com/bcoe/yargs/blob/master/lib/validation.js#L83-L110
function checkForUnknownArguments(yargs, argv, command) {
	const aliasLookup = {};
	const flags = yargs.getOptions().key;
	const demanded = yargs.getDemanded();
	const unknown = [];

	Object.keys(yargs.parsed.aliases || {}).forEach((key) => {
		yargs.parsed.aliases[key].forEach((alias) => {
			aliasLookup[alias] = key;
		});
	});

	function isUnknown(key) {
		return (key !== '$0' && key !== '_' && key !== 'params' &&
			!demanded.hasOwnProperty(key) &&
			!flags.hasOwnProperty(key) &&
			!aliasLookup.hasOwnProperty('no-' + key) &&
			!aliasLookup.hasOwnProperty(key));
	}

	function aliasFor(key) {
		return command.unaliasOption(key);
	}

	Object.keys(argv).forEach((key) => {
		const alias = aliasFor(key);
		if (isUnknown(key) && (!alias || isUnknown(alias))) {
			unknown.push(key);
		}
	});

	if (unknown.length) {
		throw unknownArgumentError(unknown);
	}
}

/**
 * Parses parameters specified with the given command. The parsed params are stored as
 * `argv.params`.
 * @param {object} yargs    The yargs command line parser
 * @param {Array<String>} argv     The parsed command line
 * @param {Array<String>} path     The command path the params apply to
 * @param {string} params   The params to parse.
 */
function parseParams(yargs, argv, path, params) {
	let required = 0;
	let optional = 0;
	let variadic = false;

	argv.params = {};

	const extra = argv._.slice(path.length);

	argv._ = argv._.slice(0, path.length);

	params.replace(/(<[^>]+>|\[[^\]]+\])/g,
		(match) => {
			if (variadic) {
				throw variadicParameterPositionError(variadic);
			}

			const isRequired = match[0] === '<';
			const param = match
				.slice(1, -1)
				.replace(/(.*)\.\.\.$/, (m, param) => {
					variadic = true;
					return param;
				});
			let value;
			if (isRequired) {
				required++;
			} else {
				optional++;
			}

			if (variadic) {
				variadic = param; // save the name
				value = extra.slice(-1 + required + optional).map(String);

				if (isRequired && !value.length) {
					throw variadicParameterRequiredError(param);
				}
			} else {
				if (isRequired && optional > 0) {
					throw requiredParameterPositionError(param);
				}

				value = extra[-1 + required + optional];

				if (value) {
					value = String(value);
				}

				if (isRequired && typeof value === 'undefined') {
					throw requiredParameterError(param);
				}
			}

			const params = param.split('|');
			params.forEach(p => {
				argv.params[p] = value;
			});
		});

	if (!variadic && required+optional < extra.length) {
		throw unknownParametersError(extra.slice(required+optional));
	}
}

/**
 * @param {object} options
 * @returns {CLIRootCategory} The root category for the app command line args.
 */
function createAppCategory(options) {
	return new CLIRootCategory(options);
}

function createCategory(parent, name, description, options) {
	if (_.isObject(description)) {
		options = description;
		description = '';
	}

	const cat = new CLICommandCategory(name, description, options);
	parent.addItem(cat);
	return cat;
}

function createCommand(category, name, description, options) {
	if (_.isObject(name)) {
		options = name;
		name = '$0';
		description = '';
	}

	if (_.isObject(description)) {
		options = description;
		description = '';
	}

	const cmd = new CLICommand(name, description, options);
	category.addItem(cmd);
	return cmd;
}

/**
 * Top-level invocation of the command processor.
 * @param {CLICommandItem} command
 * @param {Array} args
 * @returns {*} The argv from yargs parsing.
 * Options/booleans are attributes of the object. The property `clicommand` contains the command corresponding
 * to the requested command. `clierror` contains any error encountered durng parsing.
 */
function parse(command, args) {
	Yargs.reset();
	Yargs.wrap(Yargs.terminalWidth());
	return command.parse(args, Yargs);
}

function baseError(message, data) {
	const error = new Error();
	// yargs doesn't pass the full error if a message is defined, only the message
	// since we need the full object, use an alias
	error.message = message;
	error.data = data || null;
	return error;
}

function usageError(message, data, type, item) {
	const error = baseError(message, data);
	error.isUsageError = true;
	error.type = type;
	error.item = item;
	return error;
}

function applicationError(message, data, type) {
	const error = baseError(message, data);
	error.isApplicationError = true;
	error.type = type;
	return error;
}

function unknownCommandError(command, item) {
	const commandString = command.join(' ');
	return usageError(`No such command '${commandString}'`, command, unknownCommandError, item);
}

function unknownArgumentError(argument) {
	const argsString = argument.join(', ');
	const s = argument.length > 1 ? 's' : '';
	return usageError(`Unknown argument${s} '${argsString}'`, argument, unknownArgumentError);
}

function requiredParameterError(param) {
	return usageError(`Parameter '${param}' is required.`, param, requiredParameterError);
}

function variadicParameterRequiredError(param) {
	return usageError(`Parameter '${param}' must have at least one item.`, param, variadicParameterRequiredError);
}

function variadicParameterPositionError(param) {
	return applicationError(`Variadic parameter '${param}' must the final parameter.`, param, variadicParameterPositionError);
}

function requiredParameterPositionError(param) {
	return applicationError(`Required parameter '${param}' must be placed before all optional parameters.`, param, requiredParameterPositionError);
}

function unknownParametersError(params) {
	const paramsString = params.join(' ');
	return usageError(`Command parameters '${paramsString}' are not expected here.`, params, unknownParametersError);
}

const errors = {
	unknownCommandError,
	unknownArgumentError,
	requiredParameterError,
	variadicParameterRequiredError,
	variadicParameterPositionError,
	requiredParameterPositionError,
	unknownParametersError
};

const test = {
	consoleErrorLogger
};

function showHelp(cb) {
	Yargs.showHelp(cb);
}

module.exports = {
	parse,
	createCommand,
	createCategory,
	createAppCategory,
	createErrorHandler,
	showHelp,
	errors,
	test,
};
