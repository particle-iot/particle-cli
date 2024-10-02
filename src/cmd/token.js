const VError = require('verror');
const inquirer = require('inquirer');
const settings = require('../../settings');
const ApiClient = require('../lib/api-client');
const prompts = require('../lib/prompts');
const CloudCommand = require('./cloud');


module.exports = class AccessTokenCommands {
	getCredentials({ includeOTP = false } = {}) {
		if (!settings.username){
			return prompts.getCredentials();
		}

		const questions = [{
			type: 'password',
			name: 'password',
			message: 'Using account ' + settings.username + '\nPlease enter your password:'
		}];

		if (includeOTP){
			questions.push({
				type: 'input',
				name: 'otp',
				message: 'Please enter a login code [optional]'
			});
		}

		return inquirer.prompt(questions)
			.then((answers) => ({
				username: settings.username,
				password: answers.password,
				otp: answers.otp
			}));
	}

	/**
	 * Creates an access token using the given client name.
	 * @returns {Promise} Will print the access token to the console, along with the expiration date.
	 */
	createAccessToken ({ expiresIn, neverExpires }) {
		const clientName = 'user';

		const api = new ApiClient();

		if (neverExpires) {
			expiresIn = 0;
		}

		return Promise.resolve().then(() => {
			return this.getCredentials();
		}).then(creds => {
			return api.createAccessToken(clientName, creds.username, creds.password, expiresIn).catch((error) => {
				if (error.error === 'mfa_required') {
					const cloud = new CloudCommand();
					return cloud.enterOtp({ mfaToken: error.mfa_token });
				}
				throw error;
			});
		}).then(result => {
			if (result.expires_in) {
				const nowUnix = Date.now();
				const expiresUnix = nowUnix + (result.expires_in * 1000);
				const expiresDate = new Date(expiresUnix);
				console.log('New access token expires on ' + expiresDate);
			} else {
				console.log('New access token never expires');
			}
			console.log('    ' + result.access_token);
		}).catch(err => {
			throw new VError(api.normalizedApiError(err), 'Error while creating a new access token');
		});
	}
};

