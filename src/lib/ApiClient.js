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
'use strict';


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
var when = require('when');
var pipeline = require('when/pipeline');
var utilities = require('./utilities.js');
var settings = require('../../settings');

var request = require('request');
var fs = require('fs');
var path = require('path');
var Spinner = require('cli-spinner').Spinner;
var chalk = require('chalk');

/**
 * Provides a framework for interacting with and testing the API
 * - apiUrl and access_token can be set, otherwise default to those in global settings
 * - accessors/mutators for access token
 * - returns promises
 * - most functions generate console output on error, but not for success
 * - tests for specific known errors such as invalid access token.
 *
 */

var ApiClient = function (baseUrl, access_token) {
	this._access_token = access_token || settings.access_token;

	this.request = request.defaults({
		baseUrl: baseUrl || settings.apiUrl,
		proxy: settings.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy
	});
};

ApiClient.prototype = {
	ready: function() {
		var hasToken = !!this._access_token;
		if (!hasToken) {
			console.log("You're not logged in. Please login using", chalk.bold.cyan('particle cloud login'), 'before using this command');
		}

		return hasToken;
	},

	clearToken: function() {
		this._access_token = null;
	},

	getToken: function () {
		return this._access_token;
	},

	updateToken: function(token) {
		this._access_token = token;
	},

	// doesn't appear to be used (renamed)
	_createUser: function (user, pass) {
		var dfd = when.defer();

		//todo; if !user, make random?
		//todo; if !pass, make random?

		//curl -d username=zachary@particle.io -d password=foobar https://api.particle.io/v1/users

		if (!user || (user === '')
			|| (!utilities.contains(user, '@'))
			|| (!utilities.contains(user, '.'))) {
			return when.reject('Username must be an email address.');
		}


		console.log('creating user: ', user);
		var that = this;

		this.request({
			uri: '/v1/users',
			method: 'POST',
			form: {
				username: user,
				password: pass
			},
			json: true
		}, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (body && body.ok) {
				console.log('user creation succeeded!');
				that._user = user;
				that._pass = pass;
			} else if (body && !body.ok && body.errors) {
				console.log('User creation ran into an issue: ', body.errors);
			} else {
				console.log('createUser got ', body + '');
			}

			dfd.resolve(body);
		});

		return dfd.promise;
	},

	/**
	 * Login and update the access token on this instance. Doesn't update the global settings.
	 * Outputs failure to the console.
	 */
	login: function (client_id, user, pass) {
		var that = this;

		return this.createAccessToken(client_id, user, pass)
			.then(function(resp) {
				that._access_token = resp.access_token;

				return when.resolve(that._access_token);
			},
			function(err) {
				return when.reject('Login Failed: ' + err);
			});
	},

	/**
	 * Creates an access token but doesn't change the CLI state/global token etc..
	 * @param client_id The OAuth client ID to identify the client
	 * @param username  The username
	 * @param password  The password
	 * @returns {Promise} to create the token
	 */
	createAccessToken: function (client_id, username, password) {
		var that = this;
		return when.promise(function (resolve, reject) {
			that.request({
				uri: '/oauth/token',
				method: 'POST',
				form: {
					username: username,
					password: password,
					grant_type: 'password',
					client_id: client_id,
					client_secret: 'client_secret_here'
				},
				json: true
			}, function (error, response, body) {
				if (error) {
					return reject(error);
				}
				if (body.error) {
					reject(body.error_description);
				} else {
					resolve(body);
				}
			});
		});
	},

	//DELETE /v1/access_tokens/{ACCESS_TOKEN}
	/**
	 * Removes the given access token, outputting any errors to the console.
	 * @returns {Promise}   To retrieve the API response body
	 */
	removeAccessToken: function (username, password, access_token) {
		var dfd = when.defer();
		this.request({
			uri: '/v1/access_tokens/' + access_token,
			method: 'DELETE',
			auth: {
				username: username,
				password: password
			},
			form: {
				access_token: this._access_token
			},
			json: true
		}, function (error, response, body) {
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
	},

	//GET /v1/access_tokens
	listTokens: function (username, password) {
		var that = this;
		return when.promise(function (resolve, reject) {
			that.request({
				uri: '/v1/access_tokens',
				method: 'GET',
				auth: {
					username: username,
					password: password
				},
				json: true
			}, function (error, response, body) {
				if (error) {
					return reject(error);
				}
				if (that.hasBadToken(body)) {
					return reject('Invalid token');
				}
				if (error || (body['ok'] === false)) {
					var err = error || body.errors;
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
	},


	//GET /v1/devices
	listDevices: function () {
		var spinner = new Spinner('Retrieving devices...');
		spinner.start();

		var that = this;
		var prom = when.promise(function(resolve, reject) {
			that.request({
				uri: '/v1/devices?access_token=' + that._access_token,
				method: 'GET',
				json: true
			}, function (error, response, body) {
				if (error) {
					return reject(error);
				}
				if (that.hasBadToken(body)) {
					return reject('Invalid token');
				}
				if (body.error) {
					console.error('listDevices got error: ', body.error);
					reject(body.error);
				} else {
					that._devices = body;
					resolve(body);
				}
			});
		});

		prom.finally(function () {
			spinner.stop(true);
		});

		return prom;
	},

	claimDevice: function (deviceId, requestTransfer) {
		var that = this;
		var dfd = when.defer();

		var params = {
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

		this.request(params, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}

			if (body && (body.ok || response.statusCode === 200)) {
				dfd.resolve(body);
			} else {
				var errors = body && body.errors && body.errors.join('\n');
				dfd.reject(errors);
			}
		});

		return dfd.promise;
	},

	removeDevice: function (deviceID) {
		console.log('releasing device ' + deviceID);

		var dfd = when.defer();
		var that = this;

		that.request({
			uri: '/v1/devices/' + deviceID,
			method: 'DELETE',
			form: {
				id: deviceID,
				access_token: this._access_token
			},
			json: true
		}, function (error, response, body) {
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
	},


	renameDevice: function (deviceId, name) {
		var that = this;
		var dfd = when.defer();

		that.request({
			uri: '/v1/devices/' + deviceId,
			method: 'PUT',
			form: {
				name: name,
				access_token: this._access_token
			},
			json: true
		}, function (error, response, body) {
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
	},

	//GET /v1/devices/{DEVICE_ID}
	getAttributes: function (deviceId) {
		var that = this;
		var dfd = when.defer();
		this.request({
			uri: '/v1/devices/' + deviceId + '?access_token=' + this._access_token,
			method: 'GET',
			json: true
		}, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	},

	//GET /v1/devices/{DEVICE_ID}/{VARIABLE}
	getVariable: function (deviceId, name) {
		var that = this;
		var dfd = when.defer();
		this.request({
			uri: '/v1/devices/' + deviceId + '/' + name + '?access_token=' + this._access_token,
			method: 'GET',
			json: true
		}, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	},

	//PUT /v1/devices/{DEVICE_ID}
	signalDevice: function (deviceId, beSignalling) {
		var dfd = when.defer();
		var that = this;
		this.request({
			uri: '/v1/devices/' + deviceId,
			method: 'PUT',
			form: {
				signal: (beSignalling) ? 1 : 0,
				access_token: this._access_token
			},
			json: true
		}, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}

			dfd.resolve(body);
		});

		return dfd.promise;
	},

	//PUT /v1/devices/{DEVICE_ID}
	// todo - this is used to both flash a binary and compile sources
	// these are quite distinct operations, and even though they hit the same API should
	// have different code paths here since there is little overlap in functionality
	flashDevice: function (deviceId, fileMapping, targetVersion) {
		console.log('attempting to flash firmware to your device ' + deviceId);

		var that = this;
		var dfd = when.defer();
		var r = this.request.put({
			uri: '/v1/devices/' + deviceId,
			qs: {
				access_token: this._access_token
			},
			json: true
		}, function (error, response, body) {
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
	},

	compileCode: function(fileMapping, platform_id, targetVersion) {
		console.log('attempting to compile firmware ');

		var that = this;
		var dfd = when.defer();
		var r = this.request.post({
			uri: '/v1/binaries',
			qs: {
				access_token: this._access_token
			},
			json: true
		}, function (error, response, body) {
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

		this._addFilesToCompile(r, fileMapping, targetVersion, platform_id);

		return dfd.promise;
	},

	_mapFilenames: function(fileMapping, messages) {

		function regexEscape(s) {
			return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
		};

		var result = [];
		var map = {};
		// prepend each logical path with a slash (since the compile server does that.)
		Object.keys(fileMapping.map).map(function addSlash(item) {
			map[path.sep+item] = fileMapping.map[item];
		});

		// escape each filename to be regex-safe and create union recogniser
		var re = new RegExp(Object.keys(map).map(regexEscape).join("|"),"gi");

		for (var i = 0, n = messages.length; i < n; i++) {
			var message = messages[i];
			message = message.replace(re, function(matched){
				return map[matched];
			});
			result.push(message);
		}
		return result;
	},

	_populateFileMapping(fileMapping) {
		if (!fileMapping.map) {
			fileMapping.map = {};
			if (fileMapping.list) {
				for (var i = 0; i < fileMapping.list.length; i++) {
					var item = fileMapping.list[i];
					fileMapping.map[item] = item;
				}
			}
		}
		return fileMapping;
	},

	_addFilesToCompile: function (r, fileMapping, targetVersion, platform_id) {
		var form = r.form();
		this._populateFileMapping(fileMapping);
		var list = Object.keys(fileMapping.map);
		for (var i = 0, n = list.length; i < n; i++) {
			var relativeFilename = list[i];
			var filename = fileMapping.map[relativeFilename];

			var name = "file" + (i ? i : "");
			form.append(name, fs.createReadStream(path.resolve(fileMapping.basePath, filename)), {
				filename: relativeFilename.replace(/\\/g, '/'),
				includePath: true
			});
		}
		if (platform_id) {
			form.append('platform_id', platform_id);
		}
		if (targetVersion) {
			form.append('build_target_version', targetVersion);
		} else {
			form.append('latest', 'true');
		}
	},

	downloadBinary: function (url, filename) {
		if (fs.existsSync(filename)) {
			try {
				fs.unlinkSync(filename);
			} catch (ex) {
				console.error('error deleting file: ' + filename + ' ' + ex);
			}
		}

		var that = this;
		var dfd = when.defer();
		console.log('downloading binary from: ' + url);
		var r = this.request.get({ uri: url, qs: { access_token: this._access_token } });
		r.pause();

		r.on('error', function(err) {
			return dfd.reject(err);
		});

		r.on('response', function(response) {
			if (that.isUnauthorized(response)) {
				return dfd.reject('Invalid token');
			}

			if (response.statusCode !== 200) {
				r.on('complete', function(resp, body) {
					return dfd.reject(body);
				});
				r.readResponseBody(response);
				r.resume();
				return;
			}

			console.log('saving to: ' + filename);
			var outFs = fs.createWriteStream(filename);
			r.pipe(outFs).on('finish', function() {
				return dfd.resolve();
			});
			r.resume();
		});

		return dfd.promise;
	},

	sendPublicKey: function (deviceId, buffer, algorithm, productId) {
		console.log('attempting to add a new public key for device ' + deviceId);

		var dfd = when.defer();
		var that = this;

		var params = {
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

		this.request(params, function (error, response, body) {
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
	},

	callFunction: function (deviceId, functionName, funcParam) {
		//console.log('callFunction for user ');

		var that = this;
		var dfd = when.defer();
		this.request({
			uri: '/v1/devices/' + deviceId + '/' + functionName,
			method: 'POST',
			form: {
				arg: funcParam,
				access_token: this._access_token
			},
			json: true
		}, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	},

	getAllAttributes: function () {
		if (this._attributeCache) {
			return when.resolve(this._attributeCache);
		}

		console.error('polling server to see what devices are online, and what functions are available');

		var that = this;
		var lookupAttributes = function (devices) {
			var tmp = when.defer();

			if (!devices || (devices.length === 0)) {
				console.log('No devices found.');
				that._attributeCache = null;
				tmp.reject('No devices found');
			} else {
				var promises = [];
				for (var i = 0; i < devices.length; i++) {
					var deviceid = devices[i].id;
					if (devices[i].connected) {
						promises.push(that.getAttributes(deviceid));
					} else {
						promises.push(when.resolve(devices[i]));
					}
				}

				when.all(promises).then(function (devices) {
					//sort alphabetically
					devices = devices.sort(function (a, b) {
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
	},

	getEventStream: function (eventName, deviceId, onDataHandler) {
		var self = this;
		var url;
		if (!deviceId) {
			url = '/v1/events';
		} else if (deviceId === 'mine') {
			url = '/v1/devices/events';
		} else {
			url = '/v1/devices/' + deviceId + '/events';
		}

		if (eventName) {
			url += '/' + eventName;
		}

		console.log('Listening to: ' + url);
		return when.promise(function(resolve, reject) {
			self.request
				.get({
					uri: url,
					qs: {
						access_token: self._access_token
					}
				})
				.on('response', function(response) {
					if (self.isUnauthorized(response)) {
						reject('Invalid access token');
					}
				})
				.on('error', reject)
				.on('close', resolve)
				.on('data', onDataHandler);
		});
	},

	publishEvent: function (eventName, data, setPrivate) {
		var that = this;
		var dfd = when.defer();
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
		}, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			if (body && body.ok) {
				var consolePrint = '';
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
	},

	createWebhookWithObj: function(obj) {
		var that = this;
		var dfd = when.defer();

		var obj = {
			uri: '/v1/webhooks',
			method: 'POST',
			json: obj,
			headers: {
				'Authorization': 'Bearer ' + this._access_token
			}
		};

		console.log('Sending webhook request ', obj);

		this.request(obj, function (error, response, body) {
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
	},

	// not used
	_createWebhook: function (event, url, deviceId, requestType, headers, json, query, auth, mydevices, rejectUnauthorized) {
		var that = this;
		var dfd = when.defer();

		var obj = {
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

		this.request(obj, function (error, response, body) {
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
	},

	deleteWebhook: function (hookID) {
		var dfd = when.defer();
		this.request({
			uri: '/v1/webhooks/' + hookID + '?access_token=' + this._access_token,
			method: 'DELETE',
			json: true
		}, function (error, response, body) {
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
	},

	listWebhooks: function () {
		var that = this;
		var dfd = when.defer();
		this.request({
			uri: '/v1/webhooks/?access_token=' + this._access_token,
			method: 'GET', json: true
		}, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	},

	getBuildTargets: function() {
		var that = this;
		var dfd = when.defer();
		this.request({
			uri: '/v1/build_targets',
			qs: {
				access_token: this._access_token,
				featured: true
			},
			method: 'GET',
			json: true
		}, function (error, response, body) {
			if (error) {
				return dfd.reject(error);
			}
			if (that.hasBadToken(body)) {
				return dfd.reject('Invalid token');
			}
			dfd.resolve(body);
		});

		return dfd.promise;
	},



	hasBadToken: function(body) {
		if (body && body.error && body.error.indexOf
			&& (body.error.indexOf('invalid_token') >= 0)) {
			// todo - factor out the console logging out of the predicate
			console.log();
			console.log(chalk.red('!'), 'Please login - it appears your access token may have expired');
			console.log();
			return true;
		}
		return false;
	},

	isUnauthorized: function(response) {
		if (response && response.statusCode === 401) {
			console.log();
			console.log(chalk.red('!'), 'Please login - it appears your access token may have expired');
			console.log();
			return true;
		}
		return false;
	}
};

module.exports = ApiClient;
