import when from 'when';
import chalk from 'chalk';
import Yargs from 'yargs';
import _ from 'lodash';

class Category {
	constructor(name, description, options) {
		this.commands = {};
		this.name = name || '$0';
		this.description = description !== undefined ? description : '';
		this.options = options || {};
		this.parent = null;
	}

	get path() {
		return this.parent
			? this.parent.path.concat([this.name])
			: [this.name];
	}

	command(command) {
		this.commands[command.name] = command;

		command.parent = this;

		return this;
	}

	run(yargs) {
		const errorHandler = createErrorHandler(yargs);

		if (this.options.options) {
			yargs.options(this.options.options);
		}
		if (this.options.setup) {
			this.options.setup(yargs);
		}
		if (this.options.examples) {
			_.forEach(this.options.examples, yargs.example.bind(yargs));
		}
		if (this.options.version) {
			yargs.version(this.options.version);
		}
		if (this.options.epilogue) {
			yargs.epilogue(this.options.epilogue);
		}

		_.forEach(this.commands, (command) => {
			yargs.command(command.name, command.description, command.run.bind(command));
		});

		yargs
			.usage('Usage: ' + this.path.join(' ') + ' <command>')
			.check((argv) => {
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
			})
			.demand(this.path.length, 'Please enter a valid command.')
			.fail(errorHandler);

		yargs.help('help');

		const argv = yargs.argv;

		return argv;
	}
}


class Command {
	constructor(name, description, options) {
		this.name = name || '$0';
		this.description = description || '';
		this.parent = null;
		this.options = _.defaultsDeep(options || {}, {
			params: '',
		});
	}

	get path() {
		return this.parent
			? this.parent.path.concat([this.name])
			: [this.name];
	}

	run(yargs) {
		const errorHandler = createErrorHandler(yargs);

		if (this.options.options) {
			yargs.options(this.options.options);
		}
		if (this.options.setup) {
			this.options.setup(yargs);
		}
		if (this.options.examples) {
			_.forEach(this.options.examples, yargs.example.bind(yargs));
		}
		if (this.options.version) {
			yargs.version(this.options.version);
		}

		yargs
			.check((argv) => {
				// We can't use `yargs.strict()` because it is possible that
				// `options.setup` changes the options during execution and this
				// seems to interfere with the timing for strict mode.
				// Additionally, `yargs.strict()` does not seem to handle pre-
				// negated params like `--no-parse`.
				checkForUnknownArguments(yargs, argv);

				if (this.options.params) {
					parseParams(yargs, argv, this);
				}

				return true;
			})
			.fail(errorHandler)
			.usage('Usage: ' + this.path.join(' ')
				+ ' [options]'
				+ (this.options.params ? ' ' + this.options.params : ''));

		yargs.help('help');

		const argv = yargs.argv;

		if (this.options.handler) {
			when.try(this.options.handler.bind(this, argv))
				.done(() => {}, errorHandler);
		}

		return argv;
	}
}

function createErrorHandler(yargs) {
	return (err) => {
		if (!err || err.isUsageError) {
			yargs.showHelp();
		}

		console.log(chalk.red(err.message || err));

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

function parseParams(yargs, argv, command) {
	let required = 0;
	let optional = 0;
	let variadic = false;

	argv.params = {};

	command.options.params.replace(/(<[^>]+>|\[[^\]]+\])/g,
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
				value = argv._.slice(command.path.length - 2 + required + optional)
					.map(String);

				if (isRequired && !value.length) {
					throw usageError('Parameter '
						+ '`' + param + '` is must have at least one item.');
				}
			} else {
				if (isRequired && optional > 0) {
					throw applicationError('Optional parameters must be specified last');
				}

				value = argv._[command.path.length - 2 + required + optional];

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

function createApp(options) {
	return new Category('$0', '', options);
};

function createCategory(name, description, options) {
	if (_.isObject(description)) {
		options = description;
		description = '';
	}

	return new Category(name, description, options);
};

function createCommand(name, description, options) {
	if (_.isObject(name)) {
		options = name;
		name = '$0';
		description = '';
	}

	if (_.isObject(description)) {
		options = description;
		description = '';
	}

	return new Command(name, description, options);
};


function run(command, yargs) {
	return command.run(yargs || Yargs);
};

function usageError(message, data) {
	const error = new Error(message ? message : undefined);

	error.data = data || null;
	error.isUsageError = true;

	return error;
};

function applicationError(message, data) {
	const error = new Error(message ? message : undefined);

	error.data = data || null;
	error.isApplicationError = true;

	return error;
};

export {
	run,
	createCommand,
	createCategory,
	createApp
};
