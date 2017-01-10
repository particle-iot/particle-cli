
var when = require('when');
var readline = require('readline');

var inquirer = require('inquirer');
var log = require('./log');

var that = {

	_prompt: null,

	/**
	 * Sets up our user input
	 * @returns {Object} prompt object
	 */
	getPrompt: function (captureInterrupt) {
		if (!that._prompt) {
			that._prompt = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			if (captureInterrupt) {
				that._prompt.on("SIGINT", function () {
					process.emit("SIGINT");
				});
			}
		}
		return that._prompt;
	},

	closePrompt: function() {
		if (that._prompt) {
			that._prompt.close();
			that._prompt = null;
		}
	},

	promptDfd: function (message) {
		var dfd = when.defer();
		var prompt = that.getPrompt();
		prompt.question(message, function (value) {
			dfd.resolve(value);
		});
		return dfd.promise;
	},
	askYesNoQuestion: function (message, alwaysResolve) {
		var dfd = when.defer();
		var prompt = that.getPrompt();
		prompt.question(message, function (value) {
			value = (value || '').toLowerCase();
			var saidYes = ((value === 'yes') || (value === 'y'));

			if (alwaysResolve) {
				dfd.resolve(saidYes);
			} else if (saidYes) {
				dfd.resolve(value);
			} else {
				dfd.reject(value);
			}
		});
		return dfd.promise;
	},

	passPromptDfd: function (message) {
		var dfd = when.defer();

		//kill the existing prompt
		that.closePrompt();

		var stdin = process.openStdin();
		stdin.setRawMode(true);
		process.stdin.setRawMode(true);
		process.stdout.write(message);

		var arr = [];
		var onStdinData = function(chunk) {
			if ((chunk[0] === 8) || (chunk[0] === 127)) {
				if (arr.length > 0) {
					arr.pop();
					process.stdout.write('\b \b');
				}
			} else if (chunk[0] === 3) {
				process.stdout.write('\nBreak!\n');
				dfd.reject('break');
			} else if (chunk[0] !== 13) {
				arr.push(chunk);
				process.stdout.write('*');
			} else {
				process.stdout.write('\n');
				dfd.resolve(arr.join(''));
			}
		};
		stdin.on('data', onStdinData);

		when(dfd.promise).ensure(function() {
			process.stdin.setRawMode(false);
			stdin.removeListener('data', onStdinData);
		});

		return dfd.promise;
	},

	/**
	 * @param {string} message The message to prompt the user
	 * @param {string} defaultValue The default value to use if the user simply hits return
	 * @param {function(string)} validator function that returns an error message if the value is not valid.
	 * @returns {Promise) to prompt and get the result. The result is undefined if the user hits ctrl-C.
	 */
	promptAndValidate: function(message, defaultValue, validator) {
		var dfd = when.defer();
		var prompt = that.getPrompt();
		message += ': ';

		function runPrompt() {
			prompt.question(message, function (value) {
				value = value || defaultValue;
				var validateError;
				if (validator) {
					validateError = validator(value);
				}

				if (validateError) {
					log.error(validateError);
					runPrompt();
				} else {
					that.closePrompt();
					dfd.resolve(value);
				}
			});
		}

		// process.on('SIGINT', function () {
		// 	that.closePrompt();
		// 	console.log();
		// 	dfd.resolve(false);
		// });

		runPrompt();
		return dfd.promise;
	},

	enterToContinueControlCToExit: function(message) {
		if (!message) {
			message = 'Press ENTER for next page, CTRL-C to exit.';
		}
		var dfd = when.defer();
		var prompt = that.getPrompt(true);
		prompt.question(message, function (value) {
			that.closePrompt();
			dfd.resolve(true);
		});
		process.on('SIGINT', function () {
			that.closePrompt();
			console.log();
			dfd.resolve(false);
		});
		return dfd.promise;
	},

	areYouSure: function() {
		return that.askYesNoQuestion('Are you sure?  Please Type yes to continue: ');
	},

	getCredentials: function (username) {
		var creds = when.defer();

		inquirer.prompt([
			that.getUsername(username),
			that.getPassword()
		], function(answers) {
			creds.resolve(answers);
		});

		return creds.promise;
	},
	getUsername: function (username) {
		return {
			type: 'input',
			name: 'username',
			message: 'Please enter your email address',
			default: username,
			validate: function(value) {
				if (!value) {
					return 'You need an email address to log in, silly!';
				}
				return true;
			}
		};
	},
	getPassword: function (msg) {
		return {
			type: 'password',
			name: 'password',
			message: msg || 'Please enter your password',
			validate: function(value) {
				if (!value) {
					return 'You need a password to log in, silly!';
				}
				return true;
			}
		};
	},
	confirmPassword: function () {
		return that.passPromptDfd('confirm password  ');
	},

	getNewCoreName: function () {
		return that.promptDfd('How shall your device be known? (name?):\t');
	},

	hitEnterWhenReadyPrompt: function () {
		console.log('');
		console.log('');
		console.log('');
		return that.promptDfd("If it isn't too much trouble, would you mind hitting ENTER when you'd like me to start?");
	},

	hitEnterWhenCyanPrompt: function () {
		console.log('');
		console.log('');
		return that.promptDfd('Sorry to bother you again, could you wait until the light is CYAN and then press ENTER?');
	},


	waitFor: function (delay) {
		var temp = when.defer();

		console.log('...(pausing for effect:' + delay + ').');
		setTimeout(function () {
			temp.resolve();
		}, delay);
		return temp.promise;
	}
};
module.exports = that;
