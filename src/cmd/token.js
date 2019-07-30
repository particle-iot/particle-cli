const VError = require('verror');
const inquirer = require('inquirer');
const settings = require('../../settings');
const ApiClient = require('../lib/api-client');
const prompts = require('../lib/prompts');
const CloudCommand = require('./cloud');


module.exports = class AccessTokenCommands {
	getCredentials() {
		if (!settings.username){
			return prompts.getCredentials();
		}

		const question = {
			type: 'password',
			name: 'password',
			message: 'Using account ' + settings.username + '\nPlease enter your password:'
		};

		return inquirer.prompt([question])
			.then((answers) => ({
				username: settings.username,
				password: answers.password
			}));
	}

	getAccessTokens (api) {
		console.error('Checking with the cloud...');

		const sortTokens = (tokens) => {
			return tokens.sort((a, b) => {
				return (b.expires_at || '').localeCompare(a.expires_at);
			});
		};

		return Promise.resolve().then(() => {
			return this.getCredentials();
		}).then(creds => {
			return api.listTokens(creds.username, creds.password);
		}).then(tokens => {
			return sortTokens(tokens);
		});
	}

	listAccessTokens () {
		const api = new ApiClient();
		return this.getAccessTokens(api).then((tokens) => {
			const lines = [];
			for (let i = 0; i < tokens.length; i++) {
				const token = tokens[i];

				let firstLine = token.client || token.client_id;
				if (token.token === settings.access_token) {
					firstLine += ' (active)';
				}
				const now = (new Date()).toISOString();
				if (now > token.expires_at) {
					firstLine += ' (expired)';
				}

				lines.push(firstLine);
				lines.push(' Token:      ' + token.token);
				lines.push(' Expires at: ' + token.expires_at || 'unknown');
				lines.push('');
			}
			console.log(lines.join('\n'));
		}).catch(err => {
			throw new VError(api.normalizedApiError(err), 'Error while listing tokens');
		});
	}

	revokeAccessToken (tokens, { force }) {
		if (tokens.length === 0) {
			console.error('You must provide at least one access token to revoke');
			return -1;
		}

		if (tokens.indexOf(settings.access_token) >= 0) {
			console.log('WARNING: ' + settings.access_token + " is this CLI's access token");
			if (force) {
				console.log('**forcing**');
			} else {
				console.log('use --force to delete it');
				return -1;
			}
		}

		const api = new ApiClient();

		return this.getCredentials()
			.then((creds) => {
				const promises = tokens.map((tkn) => {
					return api.removeAccessToken(creds.username, creds.password, tkn)
						.then(() => {
							console.log('successfully deleted ' + tkn);
							if (tkn === settings.access_token){
								settings.override(null, 'access_token', null);
							}
						});
				});

				return Promise.all(promises)
					.catch(err => {
						throw new VError(api.normalizedApiError(err), 'Error while revoking tokens');
					});
			});
	}

	/**
	 * Creates an access token using the given client name.
	 * @returns {Promise} Will print the access token to the console, along with the expiration date.
	 */
	createAccessToken () {
		const clientName = 'user';

		const api = new ApiClient();

		return Promise.resolve().then(() => {
			return this.getCredentials();
		}).then(creds => {
			return api.createAccessToken(clientName, creds.username, creds.password).catch((error) => {
				if (error.error === 'mfa_required') {
					const cloud = new CloudCommand();
					return cloud.enterOtp({ mfaToken: error.mfa_token });
				}
				throw error;
			});
		}).then(result => {
			const nowUnix = Date.now();
			const expiresUnix = nowUnix + (result.expires_in * 1000);
			const expiresDate = new Date(expiresUnix);
			console.log('New access token expires on ' + expiresDate);
			console.log('    ' + result.access_token);
		}).catch(err => {
			throw new VError(api.normalizedApiError(err), 'Error while creating a new access token');
		});
	}
};

