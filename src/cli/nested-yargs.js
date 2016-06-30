/**
 * Builds the command line parser based on yargs.
 *
 * The commands are arranged as a hierarchy, with the root representing invocation with no commands, children
 * under the root as the first level of commands, their children are 2nd level commands etc.
 *
 * The immediate child commands of the root is built by calling the `setup()` method on the root command configuration,
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

import when from 'when';
import chalk from 'chalk';
import Yargs from 'yargs';
import _ from 'lodash';

class CLICommandItem {

	/**
	 *
	 * @param name
	 * @param description
	 * @param options - options for yargs processing. it has these defined attributes:
	 *  - options: the options to pass to yargs
	 *  - setup: a function called with yargs to allow additional setup of the command line parsing
	 *  - examples: an array of examples to add to yargs
	 *  - version: the version function to pass to yargs
	 */
	constructor(name, description, options) {
		if (!name) {
			throw Error('name must be defined');
		}
		this.commands = {};
		this.name = name;
		this.description = description !== undefined ? description : '';
		this.options = options || {};
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

	_item(name) {
		return this.commands[name];
	}

	/**
	 * Finds the command at the given path.
	 * @param path
	 * @returns {*}
	 */
	find(path) {
		if (!path) {
			return this;
		}
		const name = path[0];
		const remain = path.slice(1);
		const cmd = this._item(name);
		return cmd && cmd.find(remain);
	}

	/**
	 * Adds a command item to this point in the command tree.
	 * @param {CLICommandItem} the command to add.
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
	 * @param yargs
	 * @param options
	 * @param setup
	 * @param examples
	 * @param version
	 * @param epilogue
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

		const errorHandler = createErrorHandler(yargs);
		yargs.fail(errorHandler);

		yargs.help('help');
	}

	parse(yargs, args) {
		const argv = yargs.argv; //args===undefined ? yargs.argv : yargs.parse(args);

		if (this.options.parsed) {
			this.options.parsed(yargs);
		}

		if (this.options.handler) {
			when.try(this.options.handler.bind(this, argv))
				.done(() => {}, errorHandler);
		}

		return argv;
	}
}

/**
 * Describes a group of commands that are related, and whose path has a common prefix.
 * Commands and sub-categories
 */
class CLICommandCategory extends CLICommandItem {
	constructor(name, description, options) {
		super(name, description, options);
		this.parent = null;
	}

	/**
	 * Checks that the given command exists.
	 * @callback
	 * @param argv  the parsed yargs arguments
	 * @returns {boolean} the validity of the check.
	 */
	check(argv) {
		const commandName = argv._[this.path.length - 1];
		const command = this.commands[commandName];

		if (!commandName) {
			throw usageError('Please enter a valid command.');
		}

		if (!command) {
			throw usageError('No such command `'
				+ this.path.slice(1).join(' ')+ ' '
				+ commandName + '`');
		}
		return true;
	}

	run(yargs, args) {
		this.configure(yargs, this.options);

		_.forEach(this.commands, (command) => {
			yargs.command(command.name, command.description, () => command.run(Yargs, args));
		});

		yargs
			.usage('Usage: ' + this.path.join(' ') + ' <command>')
			.check((argv) => this.check(argv))
			.demand(this.path.length, 'Please enter a valid command2.');

		return this.parse(yargs, args);
	}
}

class CLIRootCategory extends CLICommandCategory {
	constructor(options) {
		super('$0', '', options);
	}

	get path() {
		return [];
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

	run(yargs, args) {

		this.configure(yargs, this.options);

		yargs
			.check((argv) => {
				// We can't use `yargs.strict()` because it is possible that
				// `options.setup` changes the options during execution and this
				// seems to interfere with the timing for strict mode.
				// Additionally, `yargs.strict()` does not seem to handle pre-
				// negated params like `--no-parse`.
				checkForUnknownArguments(yargs, argv);

				if (this.options.params) {
					parseParams(yargs, argv, this.path, this.options.params);
				}

				return true;
			})
			.usage('Usage: ' + this.path.join(' ')
				+ ' [options]'
				+ (this.options.params ? ' ' + this.options.params : ''));

		return this.parse(yargs, args);
	}
}

/**
 * Creates an error handler. The handler displays the error message if there is one,
 * or displays the help if there ie no error or it is a usage error.
 * @param {object} yargs
 * @returns {function(err)} the error handler function
 */
function createErrorHandler(yargs) {
	return (err) => {
		if (!err || err.isUsageError) {
			yargs.showHelp();
		}

		console.log(chalk.red(err.message || err));
		if (err.stack) {
			console.log(err, err.stack.split("\n"));
		}
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

	if (unknown.length === 1) {
		throw usageError('Unknown argument: ' + unknown[0]);
	} else if (unknown.length > 1) {
		throw usageError('Unknown arguments: ' + unknown.join(', '));
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

	params.replace(/(<[^>]+>|\[[^\]]+\])/g,
		(match) => {
			if (variadic) {
				throw applicationError('Variadic parameters must the final parameter.');
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
				value = argv._.slice(path.length - 2 + required + optional)
					.map(String);

				if (isRequired && !value.length) {
					throw usageError('Parameter '
						+ '`' + param + '` is must have at least one item.');
				}
			} else {
				if (isRequired && optional > 0) {
					throw applicationError('Optional parameters must be specified last');
				}

				value = argv._[path.length - 2 + required + optional];

				if (value) {
					value = String(value);
				}

				if (isRequired && typeof value === 'undefined') {
					throw usageError('Parameter ' + '`' + param + '` is required.');
				}
			}

			argv.params[param] = value;
		});
}

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
 * @param command
 * @param args
 * @returns {*}
 */
function run(command, args) {
	return (args===Yargs) ? command.run(args, undefined) : command.run(Yargs, args);
}

function baseError(message, data) {
	const error = new Error();
	// yargs doesn't pass the full error if a message is defined, only the message
	// since we need the full object, use an alias
	error.msg = message;
	error.data = data || null;
	return error;
}

function usageError(message, data) {
	const error = baseError(message, data);
	error.isUsageError = true;
	return error;
}

function applicationError(message, data) {
	const error = baseError(message, data);
	error.isApplicationError = true;
	return error;
}

export {
	run,
	createCommand,
	createCategory,
	createAppCategory
};
