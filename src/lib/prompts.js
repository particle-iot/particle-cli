
const when = require('when');
const readline = require('readline');
const inquirer = require('inquirer');
const log = require('./log');

const prompts = {

	_prompt: null,

	/**
	 * Sets up our user input
	 * @returns {Object} prompt object
	 */
	getPrompt(captureInterrupt) {
		if (!prompts._prompt) {
			prompts._prompt = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			if (captureInterrupt) {
				prompts._prompt.on('SIGINT', () => {
					process.emit('SIGINT');
				});
			}
		}
		return prompts._prompt;
	},

	closePrompt() {
		if (prompts._prompt) {
			prompts._prompt.close();
			prompts._prompt = null;
		}
	},

	promptDfd(message) {
		let dfd = when.defer();
		let prompt = prompts.getPrompt();
		prompt.question(message, (value) => {
			dfd.resolve(value);
		});
		return dfd.promise;
	},

	passPromptDfd(message) {
		let dfd = when.defer();

		//kill the existing prompt
		prompts.closePrompt();

		let stdin = process.openStdin();
		stdin.setRawMode(true);
		process.stdin.setRawMode(true);
		process.stdout.write(message);

		let arr = [];
		let onStdinData = (chunk) => {
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

		when(dfd.promise).ensure(() => {
			process.stdin.setRawMode(false);
			stdin.removeListener('data', onStdinData);
		});

		return dfd.promise;
	},

	/**
	 * @param {string} message The message to prompt the user
	 * @param {string} defaultValue The default value to use if the user simply hits return
	 * @param {Function} validator function that returns an error message if the value is not valid.
	 * @returns {Promise} to prompt and get the result. The result is undefined if the user hits ctrl-C.
	 */
	promptAndValidate(message, defaultValue, validator) {
		let dfd = when.defer();
		let prompt = prompts.getPrompt();
		message += ': ';

		function runPrompt() {
			prompt.question(message, (value) => {
				value = value || defaultValue;
				let validateError;
				if (validator) {
					validateError = validator(value);
				}

				if (validateError) {
					log.error(validateError);
					runPrompt();
				} else {
					prompts.closePrompt();
					dfd.resolve(value);
				}
			});
		}

		runPrompt();
		return dfd.promise;
	},

	enterToContinueControlCToExit(message) {
		if (!message) {
			message = 'Press ENTER for next page, CTRL-C to exit.';
		}
		let dfd = when.defer();
		let prompt = prompts.getPrompt(true);
		prompt.question(message, () => {
			prompts.closePrompt();
			dfd.resolve(true);
		});
		process.on('SIGINT', () => {
			prompts.closePrompt();
			console.log();
			dfd.resolve(false);
		});
		return dfd.promise;
	},

	getCredentials(username) {
		let creds = when.defer();

		inquirer.prompt([
			prompts.getUsername(username),
			prompts.getPassword()
		]).then((answers) => {
			creds.resolve(answers);
		});

		return creds.promise;
	},
	getUsername(username) {
		return {
			type: 'input',
			name: 'username',
			message: 'Please enter your email address',
			default: username,
			validate(value) {
				if (!value) {
					return 'You need an email address to log in, silly!';
				}
				return true;
			}
		};
	},
	getPassword(msg) {
		return {
			type: 'password',
			name: 'password',
			message: msg || 'Please enter your password',
			validate(value) {
				if (!value) {
					return 'You need a password to log in, silly!';
				}
				return true;
			}
		};
	},
	confirmPassword() {
		return prompts.passPromptDfd('confirm password  ');
	},
	getOtp() {
		return inquirer.prompt([
			{
				type: 'input',
				name: 'otp',
				message: 'Please enter a login code'
			}
		]).then((ans) => ans.otp);
	}
};

module.exports = prompts;
