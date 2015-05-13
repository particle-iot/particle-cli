/**
 ******************************************************************************
 * @file    commands/AccessTokenCommands.js
 * @author  Kyle Marsh (kyle@cs.hmc.edu)
 * @source  https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Access Token commands module
 ******************************************************************************
Copyright (c) 2014 Spark Labs, Inc.  All rights reserved.

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

var when = require('when');
var pipeline = require('when/pipeline');
var parallel = require('when/parallel');
var sequence = require('when/sequence');

var extend = require('xtend');
var fs = require('fs');
var path = require('path');
var readline = require('readline');
var util = require('util');
var inquirer = require('inquirer');

var ApiClient = require('../lib/ApiClient.js');
var BaseCommand = require("./BaseCommand.js");
var prompts = require('../lib/prompts.js');
var settings = require('../settings.js');
var utilities = require('../lib/utilities.js');

var AccessTokenCommands = function (cli, options) {
	AccessTokenCommands.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(AccessTokenCommands, BaseCommand);
AccessTokenCommands.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "token",
	description: "tools to manage access tokens (require username/password)",

	init: function () {
		this.addOption("list", this.listAccessTokens.bind(this), "List all access tokens for your account");
		this.addOption("revoke", this.revokeAccessToken.bind(this), "Revoke an access token");
		this.addOption("new", this.createAccessToken.bind(this), "Create a new access token");
	},

	getCredentials: function() {
		if (settings.username) {
			var creds = when.defer();

			inquirer.prompt([
				prompts.getPassword('Please re-enter your password')
			], function (answers) {
				creds.resolve({
					username: settings.username,
					password: answers.password
				});
			});

			return creds.promise;
		} else {
			return prompts.getCredentials();
		}
	},

	checkArguments: function (args) {
		this.options = this.options || {};

		if (!this.options.force) {
			idx = args.indexOf('--force');
			if (idx >= 0) {
				this.options.force = true;
				args.splice(idx, 1);
			}
		}
	},

	getAccessTokens: function () {
		console.error("Checking with the cloud...");

		var sort_tokens = function (tokens) {
			return tokens.sort(function (a, b) {
				return (b.expires_at || '').localeCompare(a.expires_at);
			});
		};

		return pipeline([
			this.getCredentials,
			function (creds) {
				var api = new ApiClient(settings.apiUrl);
				return api.listTokens(creds.username, creds.password);
			},
			sort_tokens
		]);
	},

	listAccessTokens: function () {

		this.getAccessTokens().done(function (tokens) {
			try {
				var lines = [];
				for (var i = 0; i < tokens.length; i++) {
					token = tokens[i];

					var first_line = token.client || token.client_id;
					if (token.token == settings.access_token) {
						first_line += ' (active)';
					}
					var now = (new Date()).toISOString();
					if (now > token.expires_at) {
						first_line += ' (expired)';
					}

					lines.push(first_line);
					lines.push(' Token:      ' + token.token);
					lines.push(' Expires at: ' + token.expires_at || 'unknown');
					lines.push('');
				}
				console.log(lines.join("\n"));
				process.exit(0);
			}
			catch (ex) {
				console.error("Error listing tokens " + ex);
				process.exit(1);
			}
		}, function(err) {
			console.log("Please make sure you're online and logged in.");
			process.exit(1);
		});
	},

	revokeAccessToken: function () {

		var args = Array.prototype.slice.call(arguments);
		this.checkArguments(args);
		tokens = args;

		if (tokens.indexOf(settings.access_token) >= 0) {
			console.log("WARNING: " + settings.access_token + " is this CLI's access token");
			if (this.options.force) {
				console.log("**forcing**");
			} else {
				console.log("use --force to delete it");
				return;
			}
		}

		var api = new ApiClient(settings.apiUrl);
		revokers = tokens.map(function(x) {
			return function (creds) {
				return [x, api.removeAccessToken(creds.username, creds.password, x)];
			};
		});

		creds = this.getCredentials();
		var allDone = creds.then(function (creds) {
			return parallel(revokers, creds);
		});

		allDone.done(function (results) {
			for (var i in results) {
				// For some reason if I just use result.done here directly it
				// uses the same value for "token" in each case. Building and
				// then calling this function rectifies the issue
				var intermediary = function(token, result) {
					result.done(
						function () {
							console.log('successfully deleted ' + token);
							process.exit(0);
						},
						function (err) {
							console.log('error revoking ' + token + ': ' + JSON.stringify(err).replace(/\"/g, ""));
							process.exit(1);
						}
					);
				}
				intermediary(results[i][0], results[i][1]);
			}
		});
		return;
	},

	createAccessToken: function (clientName) {

		if (!clientName) {
			clientName = "user";
		}

		var allDone = pipeline([
			this.getCredentials,
			function (creds) {
				var api = new ApiClient(settings.apiUrl);
				return api.createAccessToken(clientName, creds.username, creds.password);
			}
		]);

		allDone.done(
			function (result) {
				var now_unix = Date.now();
				var expires_unix = now_unix + (result.expires_in * 1000);
				var expires_date = new Date(expires_unix);
				console.log('New access token expires on ' + expires_date);
				console.log('    ' + result.access_token);
				process.exit(0);
			},
			function (err) {
				// console.log("there was an error creating a new access token: " + err);
				process.exit(1);
			}
		);
		return;
	},

	_: null
});

module.exports = AccessTokenCommands;
