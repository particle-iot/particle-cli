/* eslint curly: [2, "multi-line"] */
'use strict';

var when = require('when');
var chalk = require('chalk');
var Yargs = require('yargs');
var _ = require('lodash');

var Cli = module.exports;

function Category (name, description, options) {
	this.commands = {};
	this.name = name || '$0';
	this.description = description !== undefined ? description : '';
	this.options = options || {};
	this.parent = null;

	Object.defineProperty(this, 'path', {
		enumerable: true,
		get: function () {
			return this.parent
				? this.parent.path.concat([this.name])
				: [this.name];
		}
	});
}

Category.prototype.command = function (command) {
	this.commands[command.name] = command;

	command.parent = this;

	return this;
};

Category.prototype.run = function (yargs) {
	var self = this;
	var errorHandler = createErrorHandler(yargs);

	_.forEach(this.commands, function (command) {
		yargs.command(command.name, command.description, command.run.bind(command));
	});

	if (this.options.setup) this.options.setup(yargs);
	if (this.options.options) yargs.options(this.options.options);
	if (this.options.examples) _.forEach(this.options.examples, yargs.example.bind(yargs));
	if (this.options.version) yargs.version(this.options.version);

	yargs
		.usage('Usage: ' + this.path.join(' ') + ' <command>')
		.check(function (argv) {
			var commandName = argv._[self.path.length - 1];
			var command = self.commands[commandName];

			if (!commandName) throw Cli.usageError('Please enter a valid command.');
			if (!command) {
				throw Cli.usageError('No such command `'
					+ self.path.slice(1).join(' ')+ ' '
					+ commandName + '`');
			}

			return true;
		})
		.demand(self.path.length, 'Please enter a valid command.')
		.fail(errorHandler);

	yargs.help('help');

	var argv = yargs.argv;

	return argv;
};


function Command (name, description, options) {
	this.name = name || '$0';
	this.description = description || '';
	this.parent = null;
	this.options = _.defaultsDeep(options || {}, {
		params: '',
	});

	Object.defineProperty(this, 'path', {
		enumerable: true,
		get: function () {
			return this.parent
				? this.parent.path.concat([this.name])
				: [this.name];
		}
	});
}

Command.prototype.run = function (yargs) {
	var self = this;
	var errorHandler = createErrorHandler(yargs);

	if (this.options.setup) this.options.setup(yargs);
	if (this.options.options) yargs.options(this.options.options);
	if (this.options.examples) _.forEach(this.options.examples, yargs.example.bind(yargs));
	if (this.options.version) yargs.version(this.options.version);

	yargs
		.check(function (argv) {
			// We can't use `yargs.strict()` because it is possible that
			// `options.setup` changes the options during execution and this
			// seems to interfere with the timing for strict mode.
			// Additionally, `yargs.strict()` does not seem to handle pre-
			// negated params like `--no-parse`.
			checkForUnknownArguments(yargs, argv);

			if (self.options.params) parseParams(yargs, argv, self);

			return true;
		})
		.fail(errorHandler)
		.usage('Usage: ' + this.path.join(' ')
			+ ' [options]'
			+ (this.options.params ? ' ' + this.options.params : ''));

	yargs.help('help');

	var argv = yargs.argv;

	if (this.options.handler) {
		when.try(this.options.handler.bind(this, argv))
			.catch(errorHandler);
	}

	return argv;
};


function createErrorHandler (yargs) {
	return function (err) {
		if (!err || !(err instanceof Error) || err.isUsageError) {
			yargs.showHelp();
		}

		console.log(chalk.red(err.message || err));

		process.exit(1);
	};
}

// Adapted from: https://github.com/bcoe/yargs/blob/master/lib/validation.js#L83-L110
function checkForUnknownArguments (yargs, argv) {
	var aliasLookup = {};
	var descriptions = yargs.getUsageInstance().getDescriptions();
	var demanded = yargs.getDemanded();
	var unknown = [];

	Object.keys(yargs.parsed.aliases || {}).forEach(function (key) {
		yargs.parsed.aliases[key].forEach(function (alias) {
			aliasLookup[alias] = key;
		});
	});

	Object.keys(argv).forEach(function (key) {
		if (key !== '$0' && key !== '_' && key !== 'params' &&
			!descriptions.hasOwnProperty(key) &&
			!demanded.hasOwnProperty(key) &&
			!aliasLookup.hasOwnProperty('no-' + key) &&
			!aliasLookup.hasOwnProperty(key)) {
				unknown.push(key);
		}
	});

	if (unknown.length === 1) {
		throw Cli.usageError('Unknown argument: ' + unknown[0]);
	} else if (unknown.length > 1) {
		throw Cli.usageError('Unknown arguments: ' + unknown.join(', '));
	}
}

function parseParams (yargs, argv, command) {
	var required = 0;
	var optional = 0;
	var variadic = false;

	argv.params = {};

	command.options.params.replace(/(<[^>]+>|\[[^\]]+\])/g,
		function (match) {
			if (variadic) {
				throw Cli.applicationError('Variadic parameters must the final parameter.');
			}

			var isRequired = match[0] === '<';
			var param = match
				.slice(1, -1)
				.replace(/(.*)\.\.\.$/, function (m, param) {
					variadic = true;
					return param;
				});
			var value;

			if (isRequired) required++;
			else optional++;

			if (variadic) {
				value = argv._.slice(command.path.length - 2 + required + optional)
					.map(String);

				if (isRequired && !value.length) {
					throw Cli.usageError('Parameter '
						+ '`' + param + '` is must have at least one item.');
				}
			} else {
				if (isRequired && optional > 0) {
					throw Cli.applicationError('Optional parameters must be specified last');
				}

				value = argv._[command.path.length - 2 + required + optional];

				if (value) value = String(value);

				if (isRequired && typeof value === 'undefined') {
					throw Cli.usageError('Parameter '
						+ '`' + param + '` is required.');
				}
			}

			argv.params[param] = value;
		});
}

Cli.createApp = function (options) {
	return new Category('$', '', options);
};

Cli.createCategory = function (name, description, options) {
	if (_.isObject(description)) {
		options = description;
		description = '';
	}

	return new Category(name, description, options);
};

Cli.createCommand = function (name, description, options) {
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


Cli.run = function (command, yargs) {
	var argv = command.run(yargs || Yargs);

	return argv;
};

Cli.usageError = function (message, data) {
	var error = new Error(message ? message : undefined);

	error.data = data || null;
	error.isUsageError = true;

	return error;
};

Cli.applicationError = function (message, data) {
	var error = new Error(message ? message : undefined);

	error.data = data || null;
	error.isApplicationError = true;

	return error;
};
