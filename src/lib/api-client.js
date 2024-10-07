/**
 ******************************************************************************
 * @file    lib/api-client.js
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
 *     var ApiClient = require('./api-client')
 *     var a = new ApiClient('http://localhost:9090')
 *     a.createUser('j3@j3.com','j3')
 *     a.login('j3@j3.com','j3')
 *     TODO: How to use this function: a.claimDevice('3').then(function(g,b) { console.log("AAAAAAAAAAA", g,b) })
 *
 **/
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const chalk = require('chalk');
const VError = require('verror');
const requestLib = require('request');
const Spinner = require('cli-spinner').Spinner;
const settings = require('../../settings');

/**
 * Provides a framework for interacting with and testing the API
 * - apiUrl and access_token can be set, otherwise default to those in global settings
 * - accessors/mutators for access token
 * - returns promises
 * - most functions generate console output on error, but not for success
 * - tests for specific known errors such as invalid access token.
 *
 */
module.exports = class ApiClient {
	#access_token;
	get _access_token() {
		return this.#access_token;
	}
	set _access_token(value) {
		this.#access_token = value;
		this.request = this.request.defaults({
			headers: {
				Authorization: `Bearer ${value}`
			}
		});
	}

	constructor(baseUrl, accessToken){
		this.#access_token = accessToken || settings.access_token;

		this.request = requestLib.defaults({
			baseUrl: baseUrl || settings.apiUrl,
			proxy: settings.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy,
			headers: {
				Authorization: `Bearer ${this._access_token}`
			}
		});
	}

	static normalizedApiError(response){
		if (_.isError(response) || response instanceof VError){
			return response;
		}

		let reason = 'Server error';
		if (typeof response === 'string'){
			reason = response;
		} else if (response.errors){
			reason = response.errors.map((err) => {
				if (err.error){
					if (err.error.status){
						return err.error.status;
					} else {
						return err.error;
					}
				} else {
					return err;
				}
			}).join('\n');
		} else if (response.info){
			reason = response.info;
		} else if (response.error){
			reason = response.error;
		} else if (response.error_description){
			reason = response.error_description;
		}
		return new Error(reason);
	}

	normalizedApiError(...args){
		return this.constructor.normalizedApiError(...args);
	}

	ensureToken(){
		if (!this._access_token){
			throw new VError(`You're not logged in. Please login using ${chalk.bold.cyan('particle cloud login')} before using this command`);
		}
	}

	hasToken(){
		return !!this._access_token;
	}

	createUser(user, pass){
		if (!user || (user === '')
			|| (!user.includes('@'))
			|| (!user.includes('.'))){
			return Promise.reject('Username must be an email address.');
		}

		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/users',
				method: 'POST',
				json: true,
				form: {
					username: user,
					password: pass
				}
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (body && !body.ok && body.errors){
					return reject(body.errors);
				}

				this._user = user;
				this._pass = pass;
				resolve(body);
			});
		});
	}

	getUser(){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/user',
				method: 'GET',
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
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
	login(clientId, user, pass){
		return this.createAccessToken(clientId, user, pass).then((body) => {
			this._access_token = body.access_token;
			return body;
		});
	}

	/**
	 * Creates an access token but doesn't change the CLI state/global token etc..
	 * @param clientId The OAuth client ID to identify the client
	 * @param username  The username
	 * @param password  The password
	 * @param [expiresIn] The number of second for the token to last
	 * @returns {Promise} to create the token
	 */
	createAccessToken(clientId, username, password, expiresIn){
		const form = {
			username: username,
			password: password,
			grant_type: 'password',
			client_id: clientId,
			client_secret: 'client_secret_here'
		};

		if (typeof expiresIn !== 'undefined') {
			form.expires_in = expiresIn;
		}

		return new Promise((resolve, reject) => {
			const options = {
				uri: '/oauth/token',
				method: 'POST',
				json: true,
				form
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (body.error){
					return reject(body);
				}

				resolve(body);
			});
		});
	}

	sendOtp(clientId, mfaToken, otp){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/oauth/token',
				method: 'POST',
				json: true,
				form: {
					mfa_token: mfaToken,
					otp,
					grant_type: 'urn:custom:mfa-otp',
					client_id: clientId,
					client_secret: 'client_secret_here'
				}
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (body.error){
					return reject(body);
				}

				this._access_token = body.access_token;
				resolve(body);
			});
		});
	}

	//GET /v1/devices
	listDevices({ silent = false } = {}){
		let spinner = new Spinner('Retrieving devices...');
		if (!silent){
			spinner.start();
		}

		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/devices',
				method: 'GET',
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (body.error){
					if (!silent){
						console.error('listDevices got error: ', body.error);
					}
					return reject(body.error);
				}

				this._devices = body;
				resolve(body);
			});
		})
			.finally(() => spinner.stop(true));
	}

	claimDevice(deviceId, requestTransfer){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/devices',
				method: 'POST',
				json: true,
				form: {
					id: (deviceId || '').toLowerCase(),
					request_transfer: requestTransfer ? true : undefined
				}
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (body && (body.error || body.errors)){
					return reject(body.error || body.errors);
				}

				resolve(body);
			});
		});
	}

	removeDevice(deviceID){
		console.log('releasing device ' + deviceID);

		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/devices/' + deviceID,
				method: 'DELETE',
				form: {
					id: deviceID
				},
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (body && (body.error || body.errors)){
					return reject(body.error || body.errors);
				}

				resolve(body);
			});
		});
	}


	renameDevice(deviceId, name){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/devices/' + deviceId,
				method: 'PUT',
				json: true,
				form: {
					name: name
				}
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (body && (body.error || body.errors)){
					return reject(body.error || body.errors);
				}

				if (body && body.name !== name){
					return reject(body);
				}

				resolve(body);
			});
		});
	}

	//GET /v1/devices/{DEVICE_ID}
	getAttributes(deviceId){
		return new Promise((resolve, reject) => {
			const options = {
				uri: `/v1/devices/${deviceId}`,
				method: 'GET',
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				resolve(body);
			});
		});
	}

	//GET /v1/devices/{DEVICE_ID}/{VARIABLE}
	getVariable(deviceId, name){
		return new Promise((resolve, reject) => {
			const options = {
				uri: `/v1/devices/${deviceId}/${name}`,
				method: 'GET',
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				resolve(body);
			});
		});
	}

	//PUT /v1/devices/{DEVICE_ID}
	signalDevice(deviceId, beSignalling){
		return new Promise((resolve, reject) => {
			const options = {
				uri: `/v1/devices/${deviceId}`,
				method: 'PUT',
				form: {
					signal: (beSignalling) ? 1 : 0
				},
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				resolve(body);
			});
		});
	}

	//PUT /v1/devices/{DEVICE_ID}
	// todo - this is used to both flash a binary and compile sources
	// these are quite distinct operations, and even though they hit the same API should
	// have different code paths here since there is little overlap in functionality
	flashDevice(deviceId, fileMapping, targetVersion){
		console.log(`attempting to flash firmware to your device ${deviceId}`);

		return new Promise((resolve, reject) => {
			const options = {
				method: 'PUT',
				uri: `/v1/devices/${deviceId}`,
				json: true
			};

			const req = this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				resolve(body);
			});

			// TODO (mirande): refactor this pattern away
			this._addFilesToCompile(req, fileMapping, targetVersion);
		});
	}

	compileCode(fileMapping, platformId, targetVersion){
		console.log('attempting to compile firmware ');

		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/binaries',
				json: true
			};

			const req = this.request.post(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (body.errors){
					body.errors = this._mapFilenames(fileMapping, body.errors);
				}

				resolve(body);
			});


			// TODO (mirande): refactor this pattern away
			this._addFilesToCompile(req, fileMapping, targetVersion, platformId);
		});
	}

	_mapFilenames(fileMapping, messages){
		function regexEscape(s){
			return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
		}

		let result = [];
		let map = {};
		// prepend each logical path with a slash (since the compile server does that.)
		Object.keys(fileMapping.map).map(function addSlash(item){
			map[path.sep+item] = fileMapping.map[item];
		});

		// escape each filename to be regex-safe and create union recogniser
		let re = new RegExp(Object.keys(map).map(regexEscape).join('|'),'gi');

		for (let i = 0, n = messages.length; i < n; i++){
			let message = messages[i];
			message = message.replace(re, (matched) => {
				return map[matched];
			});
			result.push(message);
		}
		return result;
	}

	_populateFileMapping(fileMapping){
		if (!fileMapping.map){
			fileMapping.map = {};
			if (fileMapping.list){
				for (let i = 0; i < fileMapping.list.length; i++){
					let item = fileMapping.list[i];
					fileMapping.map[item] = item;
				}
			}
		}
		return fileMapping;
	}

	_addFilesToCompile (r, fileMapping, targetVersion, platformId){
		let form = r.form();
		this._populateFileMapping(fileMapping);
		let list = Object.keys(fileMapping.map);
		for (let i = 0, n = list.length; i < n; i++){
			let relativeFilename = list[i];
			let filename = fileMapping.map[relativeFilename];

			let name = 'file' + (i ? i : '');
			form.append(name, fs.createReadStream(path.resolve(fileMapping.basePath, filename)), {
				filename: relativeFilename.replace(/\\/g, '/'),
				includePath: true
			});
		}

		if (platformId != null){
			form.append('platform_id', platformId);
		}

		if (targetVersion){
			form.append('build_target_version', targetVersion);
		} else {
			form.append('latest', 'true');
		}
	}

	downloadBinary(url, filename){
		if (fs.existsSync(filename)){
			try {
				fs.unlinkSync(filename);
			} catch (ex){
				console.error(`error deleting file: ${filename} ${ex}`);
			}
		}

		console.log(`downloading binary from: ${url}`);

		return new Promise((resolve, reject) => {
			const options = {
				uri: url
			};

			const req = this.request.get(options);

			req.pause();
			req.on('error', (err) => reject(err));
			req.on('response', (res) => {
				if (this.isUnauthorized(res)){
					return reject('Invalid token');
				}

				if (res.statusCode !== 200){
					req.on('complete', (resp, body) => reject(body));
					req.readResponseBody(res);
					req.resume();
					return;
				}

				console.log('saving to: ' + filename);

				const outFs = fs.createWriteStream(filename);
				req.pipe(outFs).on('finish', () => resolve());
				req.resume();
			});
		});
	}

	sendPublicKey(deviceId, buffer, algorithm, productId){
		console.log('attempting to add a new public key for device ' + deviceId);

		return new Promise((resolve, reject) => {
			const options = {
				uri: `/v1/provisioning/${deviceId}`,
				method: 'POST',
				json: true,
				form: {
					deviceID: deviceId,
					publicKey: buffer.toString(),
					order: `manual_${Date.now()}`,
					filename: 'cli',
					algorithm: algorithm,
				}
			};

			if (productId !== undefined){
				options.form.product_id = productId;
			}

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (body.error){
					return reject(body.error);
				}

				console.log('submitting public key succeeded!');
				this._devices = body;
				resolve(response);
			});
		});
	}

	callFunction(deviceId, functionName, funcParam){
		return new Promise((resolve, reject) => {
			const options = {
				uri: `/v1/devices/${deviceId}/${functionName}`,
				method: 'POST',
				json: true,
				form: {
					arg: funcParam
				}
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				resolve(body);
			});
		});
	}

	getAllAttributes(){
		if (this._attributeCache){
			return Promise.resolve(this._attributeCache);
		}

		console.log('polling server to see what devices are online, and what functions are available');

		return this.listDevices()
			.then(devices => {
				if (!devices || (devices.length === 0)){
					console.log('No devices found.');
					this._attributeCache = null;
					return Promise.reject('No devices found');
				}

				let promises = [];

				for (let i = 0; i < devices.length; i++){
					let deviceid = devices[i].id;

					if (devices[i].connected){
						promises.push(this.getAttributes(deviceid));
					} else {
						promises.push(Promise.resolve(devices[i]));
					}
				}

				return Promise.all(promises)
					.then(devices => {
						devices = devices.sort((a, b) => {
							return (a.name || '').localeCompare(b.name);
						});
						this._attributeCache = devices;
						return devices;
					});
			});
	}

	getEventStream(eventName, deviceId, onDataHandler){
		let failed = false;
		let url;

		if (!deviceId){
			url = '/v1/events';
		} else if (deviceId === 'mine'){
			url = '/v1/devices/events';
		} else {
			url = `/v1/devices/${deviceId}/events`;
		}

		if (eventName){
			url += `/${encodeURIComponent(eventName)}`;
		}

		console.log(`Listening to: ${url}`);

		return new Promise((resolve, reject) => {
			const options = {
				uri: url
			};

			this.request.get(options)
				.on('response', (res) => {
					if (this.isUnauthorized(res)){
						reject('Invalid access token');
					}

					if (res.statusCode >= 300){
						failed = true;
					}
				})
				.on('error', (err) => reject(err))
				.on('cloud', (data) => resolve(data))
				.on('data', (data) => {
					if (failed){
						return reject(JSON.parse(data));
					}
					onDataHandler(data);
				});
		});
	}

	publishEvent(eventName, data){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/devices/events',
				method: 'POST',
				json: true,
				form: {
					name: eventName,
					data: data,
					private: true
				}
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (body && body.error){
					console.log('Server said', body.error);
					return reject(body);
				}

				console.log(`Published private event: ${eventName}`);
				console.log('');
				resolve(body);
			});
		});
	}

	createWebhookWithObj(obj){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/webhooks',
				method: 'POST',
				json: obj
			};

			console.log('Sending webhook request ', options);

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (!body || !body.ok){
					return reject(body);
				}

				if (body && body.error){
					return reject(body.error);
				}

				console.log('Successfully created webhook with ID ' + body.id);
				resolve(body);
			});
		});
	}

	deleteWebhook(hookID){
		return new Promise((resolve, reject) => {
			const options = {
				uri: `/v1/webhooks/${hookID}`,
				method: 'DELETE',
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}
				if (body && body.ok){
					console.log('Successfully deleted webhook!');
					resolve(body);
				} else if (body && body.error){
					reject(body.error);
				}
			});
		});
	}

	listWebhooks(){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/webhooks',
				method: 'GET',
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				resolve(body);
			});
		});
	}

	getBuildTargets(){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/build_targets',
				qs: {
					featured: true
				},
				method: 'GET',
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				resolve(body);
			});
		});
	}

	getClaimCode(){
		return new Promise((resolve, reject) => {
			const options = {
				uri: '/v1/device_claims',
				method: 'POST',
				json: true
			};

			this.request(options, (error, response, body) => {
				if (error){
					return reject(error);
				}

				if (this.hasBadToken(body)){
					return reject('Invalid token');
				}

				if (!body || !body.claim_code){
					return reject(new Error('Unable to obtain claim code'));
				}

				resolve(body);
			});
		});
	}

	hasBadToken(body){
		if (body && body.error && body.error.indexOf
			&& (body.error.indexOf('invalid_token') >= 0)){
			// todo - factor out the console logging out of the predicate
			console.log();
			console.log(chalk.red('!'), 'Please login - it appears your access token may have expired');
			console.log();
			return true;
		}
		return false;
	}

	isUnauthorized(response){
		if (response && response.statusCode === 401){
			console.log();
			console.log(chalk.red('!'), 'Please login - it appears your access token may have expired');
			console.log();
			return true;
		}
		return false;
	}
};

