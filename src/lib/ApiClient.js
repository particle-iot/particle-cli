/**
 ******************************************************************************
 * @file    lib/ApiClient.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Basic API wrapper module
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



/**
 *
 * Example Usage:
 *
 *     # on command line in test dir
 *     node
 *
 *     # in node Repl
 *     var ApiClient = require('./ApiClient')
 *     var a = new ApiClient('http://localhost:9090')
 *     a.createUser('j3@j3.com','j3')
 *     a.login('j3@j3.com','j3')
 *     TODO: How to use this function: a.claimDevice('3').then(function(g,b) { console.log("AAAAAAAAAAA", g,b) })
 *
 **/
const when = require('when');
const VError = require('verror');
const pipeline = require('when/pipeline');
const utilities = require('./utilities');
const settings = require('../../settings');

const request = require('request');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const Spinner = require('cli-spinner').Spinner;
const chalk = require('chalk');

/**
 * Provides a framework for interacting with and testing the API
 * - apiUrl and access_token can be set, otherwise default to those in global settings
 * - accessors/mutators for access token
 * - returns promises
 * - most functions generate console output on error, but not for success
 * - tests for specific known errors such as invalid access token.
 *
 */

class ApiClient {
	constructor(baseUrl, accessToken) {
		this._access_token = accessToken || settings.access_token;

		this.request = request.defaults({
			baseUrl: baseUrl || settings.apiUrl,
			proxy: settings.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy
		});
	}
	ready() {
		let hasToken = this.hasToken();

		if (!hasToken) {
			console.log("You're not logged in. Please login using", chalk.bold.cyan('particle cloud login'), 'before using this command');
		}

		return hasToken;
	}

	ensureToken() {
		if (!this._access_token) {
			throw new Error(`You're not logged in. Please login using ${chalk.bold.cyan('particle cloud login')} before using this command`);
		}
	}

	hasToken() {
		return !!this._access_token;
	}

	clearToken() {
		this._access_token = null;
	}

	getToken () {
		return this._access_token;
	}

	updateToken(token) {
		this._access_token = token;
	}

	createUser(user, pass) {
		let dfd = when.defer();

		//todo; if !user, make random?
		//todo; if !pass, make random?

		//curl -d username=zachary@particle.io -d password=foobar https://api.particle.io/v1/users

		if (!user || (user === '')
			|| (!utilities.contains(user, '@'))
			|| (!utilities.contains(user, '.'))) {
			return when.reject('Username must be an email address.');
		}

		let that = this;

		this.request({
			uri: '/v1/users',
			method: 'POST',
			form: {
				username: user,
				password: pass
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (body && body.ok) {
				that._user = user;
				that._pass = pass;
			} else if (body && !body.ok && body.errors) {
				return dfd.reject(body.errors);
			}

			dfd.resolve(body);
		});

		return dfd.promise;
	}

	getUser(token){
		const { request, hasBadToken } = this;
		token = token || this._access_token;

		return when.promise((resolve, reject) => {
			request({
				uri: '/v1/user',
				method: 'GET',
				json: true,
				headers: {
					Authorization: `Bearer ${token}`
				}
			}, (error, response, body) => {
				if (error) {
					return reject(error);
				}
				if (hasBadToken(body)) {
					// TODO (mirande): throw a real error and supress the logging
					// done within hasBadToken();
					return reject('Invalid token');
				}
				return resolve(body);
			});
		});
	}

	/**
	 * Login and update the access token on this instance. Doesn't update the global settings.
	 * Outputs failure to the console.
	 */
	login(clientId, user, pass) {
		let that = this;

		return this.createAccessToken(clientId, user, pass).then((body) => {
			that._access_token = body.access_token;
			return body;
		});
	}

	/**
	 * Creates an access token but doesn't change the CLI state/global token etc..
	 * @param clientId The OAuth client ID to identify the client
	 * @param username  The username
	 * @param password  The password
	 * @returns {Promise} to create the token
	 */
	createAccessToken (clientId, username, password) {
		let that = this;
		return when.promise((resolve, reject) => {
			that.request({
				uri: '/oauth/token',
				method: 'POST',
				form: {
					username: username,
					password: password,
					grant_type: 'password',
					client_id: clientId,
					client_secret: 'client_secret_here'
				},
				json: true
			}, (error, response, body) => {
				if (error) {
					return reject(error);
				}
				if (body.error) {
					reject(body);
				} else {
					resolve(body);
				}
			});
		});
	}

	sendOtp (clientId, mfaToken, otp) {
		return when.promise((resolve, reject) => {
			this.request({
				uri: '/oauth/token',
				method: 'POST',
				form: {
					mfa_token: mfaToken,
					otp,
					grant_type: 'urn:custom:mfa-otp',
					client_id: clientId,
					client_secret: 'client_secret_here'
				},
				json: true
			}, (error, response, body) => {
				if (error) {
					return reject(error);
				}
				if (body.error) {
					reject(body);
				} else {
					this._access_token = body.access_token;
					resolve(body);
				}
			});
		});
	}

	//DELETE /v1/access_tokens/{ACCESS_TOKEN}
	/**
	 * Removes the given access token, outputting any errors to the console.
	 * @returns {Promise}   To retrieve the API response body
	 */
	removeAccessToken (username, password, accessToken) {
		let dfd = when.defer();
		this.request({
			uri: '/v1/access_tokens/' + accessToken,
			method: 'DELETE',
			auth: {
				username: username,
				password: password
			},
			form: {
				access_token: this._access_token
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				console.error('error removing token: ' + error);
				return dfd.reject(error);
			}

			if (body && body.ok) {
				dfd.resolve(body);
			} else if (body && (body.error || body.errors)) {
				dfd.reject(body.error || body.errors);
			} else {
				//huh?
				dfd.reject(body);
			}
		});

		return dfd.promise;
	}

	//GET /v1/access_tokens
	listTokens (username, password) {
		let that = this;
		return when.promise((resolve, reject) => {
			that.request({
				uri: '/v1/access_tokens',
				method: 'GET',
				auth: {
					username: username,
					password: password
				},
				json: true
			}, (error, response, body) => {
				if (error) {
					return reject(error);
				}
				if (that.hasBadToken(body)) {
					return reject('Invalid token');
				}
				if (error || (body['ok'] === false)) {
					let err = error || body.errors;
					if (typeof err == 'object') {
						err = err.join(', ');
					}
					console.error('error listing tokens: ', err);
					reject(error || body.errors);
				} else {
					resolve(body);
				}
			});
		});
	}


	//GET /v1/devices
	listDevices ({ silent = false } = {}) {
		let spinner = new Spinner('Retrieving devices...');
		if (!silent) {
			spinner.start();
		}

		let that = this;
		let prom = when.promise((resolve, reject) => {
			that.request({
				uri: '/v1/devices?access_token=' + that._access_token,
				method: 'GET',
				json: true
			}, (error, response, body) => {
				if (error) {
					return reject(error);
				}
				if (that.hasBadToken(body)) {
					return reject('Invalid token');
				}
				if (body.error) {
					if (!silent) {
						console.error('listDevices got error: ', body.error);
					}
					reject(body.error);
				} else {
					that._devices = body;
					resolve(body);
				}
			});
		});

		prom.finally(() => {
			spinner.stop(true);
		});

		return prom;
	}

	claimDevice (deviceId, requestTransfer) {
		let that = this;
		let dfd = when.defer();

		let params = {
			uri: '/v1/devices',
			method: 'POST',
			form: {
				id: deviceId,
				access_token: this._access_token
			},
			json: true
		};

		if (requestTransfer) {
			params.form.request_transfer = true;
		}

		this.request(params, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}

			if (body && (body.ok || response.statusCode === 200)) {
				dfd.resolve(body);
			} else {
				let errors = body && body.errors && body.errors.join('\n');
				dfd.reject(errors);
			}
		});

		return dfd.promise;
	}

	removeDevice (deviceID) {
		console.log('releasing device ' + deviceID);

		let dfd = when.defer();
		let that = this;

		that.request({
			uri: '/v1/devices/' + deviceID,
			method: 'DELETE',
			form: {
				id: deviceID,
				access_token: this._access_token
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}

			if (body && body.ok) {
				dfd.resolve(body);
			} else if (body && body.error) {
				dfd.reject(body.error);
			}
		});

		return dfd.promise;
	}


	renameDevice (deviceId, name) {
		let that = this;
		let dfd = when.defer();

		that.request({
			uri: '/v1/devices/' + deviceId,
			method: 'PUT',
			form: {
				name: name,
				access_token: this._access_token
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}

			if (body && (body.name === name)) {
				dfd.resolve(body);
			} else {
				dfd.reject(body);
			}
		});

		return dfd.promise;
	}

	//GET /v1/devices/{DEVICE_ID}
	getAttributes (deviceId) {
		let that = this;
		let dfd = when.defer();
		this.request({
			uri: '/v1/devices/' + deviceId + '?access_token=' + this._access_token,
			method: 'GET',
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	}

	//GET /v1/devices/{DEVICE_ID}/{VARIABLE}
	getVariable (deviceId, name) {
		let that = this;
		let dfd = when.defer();
		this.request({
			uri: '/v1/devices/' + deviceId + '/' + name + '?access_token=' + this._access_token,
			method: 'GET',
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	}

	//PUT /v1/devices/{DEVICE_ID}
	signalDevice (deviceId, beSignalling) {
		let dfd = when.defer();
		let that = this;
		this.request({
			uri: '/v1/devices/' + deviceId,
			method: 'PUT',
			form: {
				signal: (beSignalling) ? 1 : 0,
				access_token: this._access_token
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}

			dfd.resolve(body);
		});

		return dfd.promise;
	}

	//PUT /v1/devices/{DEVICE_ID}
	// todo - this is used to both flash a binary and compile sources
	// these are quite distinct operations, and even though they hit the same API should
	// have different code paths here since there is little overlap in functionality
	flashDevice (deviceId, fileMapping, targetVersion) {
		console.log('attempting to flash firmware to your device ' + deviceId);

		let that = this;
		let dfd = when.defer();
		let r = this.request.put({
			uri: '/v1/devices/' + deviceId,
			qs: {
				access_token: this._access_token
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		// NB: fileMaping may be a singleton list of a binary file to flash
		this._addFilesToCompile(r, fileMapping, targetVersion);


		return dfd.promise;
	}

	compileCode(fileMapping, platformId, targetVersion) {
		console.log('attempting to compile firmware ');

		let that = this;
		let dfd = when.defer();
		let r = this.request.post({
			uri: '/v1/binaries',
			qs: {
				access_token: this._access_token
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			if (body.errors) {
				body.errors = that._mapFilenames(fileMapping, body.errors);
			}
			dfd.resolve(body);
		});

		this._addFilesToCompile(r, fileMapping, targetVersion, platformId);

		return dfd.promise;
	}

	_mapFilenames(fileMapping, messages) {

		function regexEscape(s) {
			return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
		}

		let result = [];
		let map = {};
		// prepend each logical path with a slash (since the compile server does that.)
		Object.keys(fileMapping.map).map(function addSlash(item) {
			map[path.sep+item] = fileMapping.map[item];
		});

		// escape each filename to be regex-safe and create union recogniser
		let re = new RegExp(Object.keys(map).map(regexEscape).join('|'),'gi');

		for (let i = 0, n = messages.length; i < n; i++) {
			let message = messages[i];
			message = message.replace(re, (matched) => {
				return map[matched];
			});
			result.push(message);
		}
		return result;
	}

	_populateFileMapping(fileMapping) {
		if (!fileMapping.map) {
			fileMapping.map = {};
			if (fileMapping.list) {
				for (let i = 0; i < fileMapping.list.length; i++) {
					let item = fileMapping.list[i];
					fileMapping.map[item] = item;
				}
			}
		}
		return fileMapping;
	}

	_addFilesToCompile (r, fileMapping, targetVersion, platformId) {
		let form = r.form();
		this._populateFileMapping(fileMapping);
		let list = Object.keys(fileMapping.map);
		for (let i = 0, n = list.length; i < n; i++) {
			let relativeFilename = list[i];
			let filename = fileMapping.map[relativeFilename];

			let name = 'file' + (i ? i : '');
			form.append(name, fs.createReadStream(path.resolve(fileMapping.basePath, filename)), {
				filename: relativeFilename.replace(/\\/g, '/'),
				includePath: true
			});
		}
		if (platformId) {
			form.append('platform_id', platformId);
		}
		if (targetVersion) {
			form.append('build_target_version', targetVersion);
		} else {
			form.append('latest', 'true');
		}
	}

	downloadBinary (url, filename) {
		if (fs.existsSync(filename)) {
			try {
				fs.unlinkSync(filename);
			} catch (ex) {
				console.error('error deleting file: ' + filename + ' ' + ex);
			}
		}

		let that = this;
		let dfd = when.defer();
		console.log('downloading binary from: ' + url);
		let r = this.request.get({ uri: url, qs: { access_token: this._access_token } });
		r.pause();

		r.on('error', (err) => {
			return dfd.reject(err);
		});

		r.on('response', (response) => {
			if (that.isUnauthorized(response)) {
				return dfd.reject('Invalid token');
			}

			if (response.statusCode !== 200) {
				r.on('complete', (resp, body) => {
					return dfd.reject(body);
				});
				r.readResponseBody(response);
				r.resume();
				return;
			}

			console.log('saving to: ' + filename);
			let outFs = fs.createWriteStream(filename);
			r.pipe(outFs).on('finish', () => {
				return dfd.resolve();
			});
			r.resume();
		});

		return dfd.promise;
	}

	sendPublicKey (deviceId, buffer, algorithm, productId) {
		console.log('attempting to add a new public key for device ' + deviceId);

		let dfd = when.defer();
		let that = this;

		let params = {
			uri: '/v1/provisioning/' + deviceId,
			method: 'POST',
			form: {
				deviceID: deviceId,
				publicKey: buffer.toString(),
				order: 'manual_' + Date.now(),
				filename: 'cli',
				algorithm: algorithm,
				access_token: this._access_token
			},
			json: true
		};

		if (productId !== undefined) {
			params.form.product_id = productId;
		}

		this.request(params, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			if (body.error) {
				dfd.reject(body.error);
			} else {
				console.log('submitting public key succeeded!');
				dfd.resolve(response);
			}

			that._devices = body;
		});

		return dfd.promise;
	}

	callFunction (deviceId, functionName, funcParam) {
		//console.log('callFunction for user ');

		let that = this;
		let dfd = when.defer();
		this.request({
			uri: '/v1/devices/' + deviceId + '/' + functionName,
			method: 'POST',
			form: {
				arg: funcParam,
				access_token: this._access_token
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	}

	getAllAttributes () {
		if (this._attributeCache) {
			return when.resolve(this._attributeCache);
		}

		console.error('polling server to see what devices are online, and what functions are available');

		let that = this;
		let lookupAttributes = (devices) => {
			let tmp = when.defer();

			if (!devices || (devices.length === 0)) {
				console.log('No devices found.');
				that._attributeCache = null;
				tmp.reject('No devices found');
			} else {
				let promises = [];
				for (let i = 0; i < devices.length; i++) {
					let deviceid = devices[i].id;
					if (devices[i].connected) {
						promises.push(that.getAttributes(deviceid));
					} else {
						promises.push(when.resolve(devices[i]));
					}
				}

				when.all(promises).then((devices) => {
					//sort alphabetically
					devices = devices.sort((a, b) => {
						return (a.name || '').localeCompare(b.name);
					});

					that._attributeCache = devices;
					tmp.resolve(devices);
				});
			}
			return tmp.promise;
		};

		return pipeline([
			that.listDevices.bind(that),
			lookupAttributes
		]);
	}

	getEventStream (eventName, deviceId, onDataHandler) {
		let self = this;
		let url;
		if (!deviceId) {
			url = '/v1/events';
		} else if (deviceId === 'mine') {
			url = '/v1/devices/events';
		} else {
			url = '/v1/devices/' + deviceId + '/events';
		}

		if (eventName) {
			url += '/' + encodeURIComponent(eventName);
		}

		let failed = false;
		console.log('Listening to: ' + url);
		return when.promise((resolve, reject) => {
			self.request
				.get({
					uri: url,
					qs: {
						access_token: self._access_token
					}
				})
				.on('response', (response) => {
					if (self.isUnauthorized(response)) {
						reject('Invalid access token');
					}
					if (response.statusCode >= 300) {
						failed = true;
					}
				})
				.on('error', reject)
				.on('close', resolve)
				.on('data', data => {
					if (failed) {
						return reject(JSON.parse(data));
					}
					onDataHandler(data);
				});
		});
	}

	publishEvent (eventName, data, setPrivate) {
		let that = this;
		let dfd = when.defer();
		this.request({
			uri: '/v1/devices/events',
			method: 'POST',
			form: {
				name: eventName,
				data: data,
				access_token: this._access_token,
				private: setPrivate
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			if (body && body.ok) {
				let consolePrint = '';
				consolePrint += 'Published ';
				if (setPrivate) {
					consolePrint += 'private';
				} else {
					consolePrint += 'public';
				}

				console.log(consolePrint,'event:',eventName);
				console.log('');
				dfd.resolve(body);
			} else if (body && body.error) {
				console.log('Server said', body.error);
				dfd.reject(body);
			}
		});

		return dfd.promise;
	}

	createWebhookWithObj(obj) {
		let that = this;
		let dfd = when.defer();

		let webhookObj = {
			uri: '/v1/webhooks',
			method: 'POST',
			json: obj,
			headers: {
				'Authorization': 'Bearer ' + this._access_token
			}
		};

		console.log('Sending webhook request ', webhookObj);

		this.request(webhookObj, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			if (body && body.ok) {
				console.log('Successfully created webhook with ID ' + body.id);
				dfd.resolve(body);
			} else if (body && body.error) {
				dfd.reject(body.error);
			} else {
				dfd.reject(body);
			}
		});

		return dfd.promise;
	}

	// not used
	_createWebhook (event, url, deviceId, requestType, headers, json, query, auth, mydevices, rejectUnauthorized) {
		let that = this;
		let dfd = when.defer();

		let obj = {
			uri: '/v1/webhooks',
			method: 'POST',
			json: true,
			form: {
				event: event,
				url: url,
				deviceid: deviceId,
				access_token: this._access_token,
				requestType: requestType,
				headers: headers,
				json: json,
				query: query,
				auth: auth,
				mydevices: mydevices,
				rejectUnauthorized: rejectUnauthorized
			}
		};

		console.log('Sending webhook request ', obj);

		this.request(obj, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			if (body && body.ok) {
				console.log('Successfully created webhook!');
				dfd.resolve(body);
			} else if (body && body.error) {
				dfd.reject(body.error);
			} else {
				dfd.reject(body);
			}
		});

		return dfd.promise;
	}

	deleteWebhook (hookID) {
		let dfd = when.defer();
		this.request({
			uri: '/v1/webhooks/' + hookID + '?access_token=' + this._access_token,
			method: 'DELETE',
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (body && body.ok) {
				console.log('Successfully deleted webhook!');
				dfd.resolve(body);
			} else if (body && body.error) {
				dfd.reject(body.error);
			}
		});

		return dfd.promise;
	}

	listWebhooks () {
		let that = this;
		let dfd = when.defer();
		this.request({
			uri: '/v1/webhooks/?access_token=' + this._access_token,
			method: 'GET', json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	}

	getBuildTargets() {
		let that = this;
		let dfd = when.defer();
		this.request({
			uri: '/v1/build_targets',
			qs: {
				access_token: this._access_token,
				featured: true
			},
			method: 'GET',
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	}

	getClaimCode() {
		let dfd = when.defer();
		this.request({
			uri: '/v1/device_claims',
			method: 'POST',
			qs: {
				access_token: this._access_token,
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return dfd.reject(error);
			}
			if (this.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			if (!body || !body.claim_code) {
				return dfd.reject(new Error('Unable to obtain claim code'));
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	}

	hasBadToken(body) {
		if (body && body.error && body.error.indexOf
			&& (body.error.indexOf('invalid_token') >= 0)) {
			// todo - factor out the console logging out of the predicate
			console.log();
			console.log(chalk.red('!'), 'Please login - it appears your access token may have expired');
			console.log();
			return true;
		}
		return false;
	}

	isUnauthorized(response) {
		if (response && response.statusCode === 401) {
			console.log();
			console.log(chalk.red('!'), 'Please login - it appears your access token may have expired');
			console.log();
			return true;
		}
		return false;
	}

	normalizedApiError(response) {
		if (_.isError(response) || response instanceof VError) {
			return response;
		}

		let reason = 'Server error';
		if (typeof response === 'string') {
			reason = response;
		} else if (response.errors) {
			reason = response.errors.map((err) => {
				if (err.error) {
					if (err.error.status) {
						return err.error.status;
					} else {
						return err.error;
					}
				} else {
					return err;
				}
			}).join('\n');
		} else if (response.info) {
			reason = response.info;
		} else if (response.error) {
			reason = response.error;
		} else if (response.error_description) {
			reason = response.error_description;
		}
		return new Error(reason);
	}
}

module.exports = ApiClient;

