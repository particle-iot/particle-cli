const os = require('os');
const VError = require('verror');
const inquirer = require('inquirer');
const settings = require('../../settings');
const ApiClient = require('../lib/api-client');
const prompts = require('../lib/prompts');
const CloudCommand = require('./cloud');

const spinnerMixin = require('../lib/spinner-mixin');
const { normalizedApiError } = require('../lib/api-client');
const ParticleAPI = require('./api');
const UI = require('../lib/ui');


module.exports = class AccessTokenCommands {
	constructor({
		stdin = process.stdin,
		stdout = process.stdout,
		stderr = process.stderr
	} = {}){
		this.stdin = stdin;
		this.stdout = stdout;
		this.stderr = stderr;
		this.ui = new UI({ stdin, stdout, stderr });
		spinnerMixin(this);
	}

	getCredentials() {
		const { username } = settings;

		if (!username){
			return prompts.getCredentials();
		}

		const question = {
			type: 'password',
			name: 'password',
			message: `Using account ${username}${os.EOL}Please enter your password:`
		};

		return inquirer.prompt([question])
			.then(({ password }) => ({ username, password }));
	}

	getAccessTokens() {
		this.ui.stdout.write(`Checking with the cloud...${os.EOL}`);

		const sortTokens = (tokens) => {
			return tokens.sort((a, b) => {
				return (b.expires_at || '').localeCompare(a.expires_at);
			});
		};

		return Promise.resolve()
			.then(() => this.getCredentials())
			.then(creds => createAPI().listAccessTokens(creds.username, creds.password))
			.then(tokens => sortTokens(tokens));
	}

	listAccessTokens() {
		return this.getAccessTokens()
			.then((tokens) => {
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
				this.ui.stdout.write(lines.join(os.EOL));
			})
			.catch((error) => {
				const message = 'Error while listing tokens';
				throw createAPIErrorResult({ error, message });
			});
	}

	revokeAccessToken ({ force, params: { tokens } }) {
		console.log('TOKENS:', tokens);
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


// UTILS //////////////////////////////////////////////////////////////////////
function createAPI(){
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}

function createAPIErrorResult({ error: e, message, json }){
	const error = new VError(normalizedApiError(e), message);
	error.asJSON = json;
	return error;
}

