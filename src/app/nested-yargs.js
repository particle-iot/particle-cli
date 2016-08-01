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

import chalk from 'chalk';
import Yargs from 'yargs';
import _ from 'lodash';

class CLICommandItem {

	/**
	 * Constructor.
	 * @param {string} name             The name of the command. This is the text the command is recognized by.
	 * @param {string} description      A description of the command. Used to print help text / error messages.
	 * @param {object} options - options for yargs processing. it has these defined attributes:
	 *  - options: the options to pass to yargs
	 *  - setup: a function called with yargs to allow additional setup of the command line parsing
	 *  - examples: an array of examples to add to yargs
	 *  - version: the version function to pass to yargs
	 */
	constructor(name, description = '', options = {}) {
		if (!name) {
			throw Error('name must be defined');
		}
		this.commands = {};
		Object.assign(this, { name, description, options });
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
	configure(yargs, {options, setup, examples, version, epilogue}) {
		if (options) {
			yargs.options(options);
		}

		if (setup) {
			setup(yargs);
		}

		if (examples) {
			_.forEach(examples, e => {
				yargs.example(e);
			});
		}

		if (version) {
			yargs.version(version);
		}

		if (epilogue) {
			yargs.epilogue(epilogue);
		}

		yargs.exitProcess(false);
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
		return _.isEqual(argv._, this.path);
	}

	/**
	 * Executes the given command, optionally consuming the result if an error handler is provided.
	 * @param {object} argv  The parsed arguments for the cli command.
	 * @returns {Promise} to run the comand
	 */
	exec(argv) {
		let promise;
		if (this.options.handler) {
			promise = this.options.handler.bind(this, argv);
		} else {
			promise = this.showHelp;
		}
		return Promise.resolve().then(() => promise());
	}

	showHelp() {

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
		// We can't use `yargs.strict()` because it is possible that
		// `options.setup` changes the options during execution and this
		// seems to interfere with the timing for strict mode.
		// Additionally, `yargs.strict()` does not seem to handle pre-
		// negated params like `--no-run`.
		checkForUnknownArguments(yargs, argv);

		// ensure common prefix
		if (!this.matches(argv)) {
			throw unknownCommandError(argv._, this);
		}

		return true;
	}

	configureParser(args, yargs) {

		this.configure(yargs, this.options);

		// add the subcommands of this category
		_.forEach(this.commands, (command) => {
			const handler = (yargs) => {
				// replace arg by cannonical command name
				args[this.path.length] = command.name;
				return { argv: command.parse(args, yargs)};
			};
			yargs.command(command.name, command.description, handler);
			if (command.options && command.options.alias) {
				yargs.command(command.options.alias, false, handler);
			}
		});

		yargs
			.usage('Usage: ' + this.path.join(' ') + ' <command>')
			.check((argv) => this.check(yargs, argv))
			.demand(this.path.length, 'Please enter a valid command.');

		return yargs;
	}

	exec() {
		
	}
}

class CLIRootCategory extends CLICommandCategory {
	constructor(options) {
		super('$0', '', options);
	}

	get path() {
		return [];
	}

	exec(yargs) {
		yargs.showHelp();
	}

}

class CLICommand extends CLICommandItem {
	/**
	 * @param {string} name The invocation name of the command on the command line
	 * @param {string} description Description of the command. Used to produce help text.
	 * @param {object} options  In addition to attributes defined by the base class:
	 * <ol><li>
	 *     handler: the function that is invoked with `this` and the parsed commandline.
	 *  </li></ul>
	 */
	constructor(name, description, options) {
		super(name, description, _.defaultsDeep(options || {}, {
			params: '',
		}));
		this.name = name || '$0';
		this.description = description || '';
		this.parent = null;
	}

	configureParser(args, yargs) {

		this.configure(yargs, this.options);

		yargs
			.check((argv) => {
				// We can't use `yargs.strict()` because it is possible that
				// `options.setup` changes the options during execution and this
				// seems to interfere with the timing for strict mode.
				// Additionally, `yargs.strict()` does not seem to handle pre-
				// negated params like `--no-run`.
				checkForUnknownArguments(yargs, argv);

				parseParams(yargs, argv, this.path, this.options.params);

				return true;
			})
			.usage('Usage: ' + this.path.join(' ')
				+ ' [options]'
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
	return (err) => {
		if (!err || err.isUsageError) {
			yargs.showHelp();
		}

		console.log(chalk.red(err.message || err));
		if (err.stack) {
			console.log(err, err.stack.split('\n'));
		}
		// todo - try to find a more controllable way to singal an error - this isn't easily testable.
		process.exit(1);
	};
}

// Adapted from: https://github.com/bcoe/yargs/blob/master/lib/validation.js#L83-L110
function checkForUnknownArguments(yargs, argv) {
	const aliasLookup = {};
	const descriptions = yargs.getUsageInstance().getDescriptions();
	const demanded = yargs.getDemanded();
	const unknown = [];

	Object.keys(yargs.parsed.aliases || {}).forEach((key) => {
		yargs.parsed.aliases[key].forEach((alias) => {
			aliasLookup[alias] = key;
		});
	});

	Object.keys(argv).forEach((key) => {
		if (key !== '$0' && key !== '_' && key !== 'params' &&
			!descriptions.hasOwnProperty(key) &&
			!demanded.hasOwnProperty(key) &&
			!aliasLookup.hasOwnProperty('no-' + key) &&
			!aliasLookup.hasOwnProperty(key)) {
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
				variadic = param;   // save the name
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

			argv.params[param] = value;
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
	return command.parse(args, Yargs);
}

function baseError(message, data) {
	const error = new Error();
	// yargs doesn't pass the full error if a message is defined, only the message
	// since we need the full object, use an alias
	error.msg = message;
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

function showHelp() {
	Yargs.showHelp();
}


export {
	parse,
	createCommand,
	createCategory,
	createAppCategory,
	createErrorHandler,
	errors,
	showHelp,
};
