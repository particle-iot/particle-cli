const readline = require('readline');
const inquirer = require('inquirer');
const log = require('./log');

const prompts = {

	_prompt: null,

	/**
	 * Sets up our user input
	 * @returns {Object} prompt object
	 */
	getPrompt(captureInterrupt){
		if (!prompts._prompt){
			prompts._prompt = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
			if (captureInterrupt){
				prompts._prompt.on('SIGINT', () => {
					process.emit('SIGINT');
				});
			}
		}
		return prompts._prompt;
	},

	closePrompt(){
		if (prompts._prompt){
			prompts._prompt.close();
			prompts._prompt = null;
		}
	},

	/**
	 * @param {string} message The message to prompt the user
	 * @param {string} defaultValue The default value to use if the user simply hits return
	 * @param {Function} validator function that returns an error message if the value is not valid.
	 * @returns {Promise} to prompt and get the result. The result is undefined if the user hits ctrl-C.
	 */
	promptAndValidate(message, defaultValue, validator){
		const prompt = prompts.getPrompt();
		message += ': ';

		return new Promise(function runPrompt(resolve, reject){
			prompt.question(message, (value) => {
				let validateError;
				value = value || defaultValue;

				if (validator){
					validateError = validator(value);
				}

				if (validateError){
					log.error(validateError);
					runPrompt(resolve, reject);
				} else {
					prompts.closePrompt();
					resolve(value);
				}
			});
		});
	},

	enterToContinueControlCToExit(message){
		if (!message){
			message = 'Press ENTER for next page, CTRL-C to exit.';
		}

		return new Promise((resolve) => {
			let prompt = prompts.getPrompt(true);

			prompt.question(message, () => {
				prompts.closePrompt();
				resolve(true);
			});

			process.on('SIGINT', () => {
				prompts.closePrompt();
				console.log();
				resolve(false);
			});
		});
	},

	async getCredentials(username){
		return inquirer.prompt([
			prompts.getUsername(username),
			prompts.getPassword()
		]);
	},

	getUsername(username){
		return {
			type: 'input',
			name: 'username',
			message: 'Please enter your email address',
			default: username,
			validate(value){
				if (!value){
					return 'You need an email address to log in, silly!';
				}
				return true;
			}
		};
	},

	getPassword(msg){
		return {
			type: 'password',
			name: 'password',
			message: msg || 'Please enter your password',
			validate(value){
				if (!value){
					return 'You need a password to log in, silly!';
				}
				return true;
			}
		};
	},

	getOtp(){
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

