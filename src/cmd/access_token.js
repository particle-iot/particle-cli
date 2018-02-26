/**
 ******************************************************************************
 * @file    commands/AccessTokenCommands.js
 * @author  Kyle Marsh (kyle@cs.hmc.edu)
 * @source  https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Access Token commands module
 ******************************************************************************
Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */

const when = require('when');
const pipeline = require('when/pipeline');

const inquirer = require('inquirer');

const ApiClient = require('../lib/ApiClient.js');
const prompts = require('../lib/prompts.js');
const settings = require('../../settings.js');

class AccessTokenCommands {
	constructor(options) {
		this.options = options;
	}

	getCredentials() {
		if (settings.username) {
			const creds = when.defer();

			inquirer.prompt([
				{
					type: 'password',
					name: 'password',
					message: 'Using account ' + settings.username + '\nPlease enter your password:'
				}
			]).then((answers) => {
				creds.resolve({
					username: settings.username,
					password: answers.password
				});
			});

			return creds.promise;
		} else {
			return prompts.getCredentials();
		}
	}

	getAccessTokens () {
		console.error('Checking with the cloud...');

		const sortTokens = (tokens) => {
			return tokens.sort((a, b) => {
				return (b.expires_at || '').localeCompare(a.expires_at);
			});
		};

		return pipeline([
			this.getCredentials,
			(creds) => {
				const api = new ApiClient();
				return api.listTokens(creds.username, creds.password);
			},
			sortTokens
		]).catch((err) => {
			console.error('Error listing access tokens', err);
			return when.reject(err);
		});
	}

	listAccessTokens () {
		return this.getAccessTokens().then((tokens) => {
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
		}).catch((err) => {
			console.log("Please make sure you're online and logged in.");
			console.log(err);
			return when.reject(err);
		});
	}

	revokeAccessToken () {
		const tokens = this.options.params.tokens;

		if (tokens.length === 0) {
			console.error('You must provide at least one access token to revoke');
			return -1;
		}

		if (tokens.indexOf(settings.access_token) >= 0) {
			console.log('WARNING: ' + settings.access_token + " is this CLI's access token");
			if (this.options.force) {
				console.log('**forcing**');
			} else {
				console.log('use --force to delete it');
				return -1;
			}
		}

		const api = new ApiClient();

		return this.getCredentials().then((creds) => {
			return when.map(tokens, (x) => {
				return api.removeAccessToken(creds.username, creds.password, x)
					.then(() => {
						console.log('successfully deleted ' + x);
						if (x === settings.access_token) {
							settings.override(null, 'access_token', null);
						}
					}, (err) => {
						console.log('error revoking ' + x + ': ' + JSON.stringify(err).replace(/\"/g, ''));
						return when.reject(err);
					});
			});
		});
	}

	/**
	 * Creates an access token using the given client name.
	 * @returns {Promise} Will print the access token to the console, along with the expiration date.
	 */
	createAccessToken () {
		const clientName = 'user';

		const allDone = pipeline([
			this.getCredentials,
			(creds) => {
				const api = new ApiClient();
				return api.createAccessToken(clientName, creds.username, creds.password);
			}
		]);

		return allDone.then(
			(result) => {
				const nowUnix = Date.now();
				const expiresUnix = nowUnix + (result.expires_in * 1000);
				const expiresDate = new Date(expiresUnix);
				console.log('New access token expires on ' + expiresDate);
				console.log('    ' + result.access_token);
			}).catch((err) => {
				console.log('there was an error creating a new access token: ' + err);
				return when.reject(err);
			});
	}
}

module.exports = AccessTokenCommands;
