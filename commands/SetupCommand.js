/**
 ******************************************************************************
 * @file    commands/SetupCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Setup commands module
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

var chalk = require('chalk');
var prompt = require('inquirer').prompt;
var ApiClient2 = require('../lib/Apiclient2');

var settings = require('../settings.js');
var BaseCommand = require("./BaseCommand.js");
var dfu = require('../lib/dfu.js');
var prompts = require('../lib/prompts.js');
var ApiClient = require('../lib/ApiClient.js');
var utilities = require('../lib/utilities.js');

var when = require('when');
var sequence = require('when/sequence');
var pipeline = require('when/pipeline');
var readline = require('readline');
var fs = require('fs');
var path = require('path');
var extend = require('xtend');
var util = require('util');


var SetupCommand = function (cli, options) {
	SetupCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(SetupCommand, BaseCommand);
SetupCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "setup",
	description: "Helps guide you through the initial claiming of your core",

	init: function () {

		//this.addOption("list", this.listCores.bind(this));
		this.addOption("*", this.runSetup.bind(this), "Guides you through setting up your account and your core");
	},

	runSetup: function (shortcut) {
		var api = new ApiClient(settings.apiUrl, settings.access_token);   //
		var serial = this.cli.getCommandModule("serial"),
			cloud = this.cli.getCommandModule("cloud");

		this.checkArguments(arguments);

		var that = this,
			coreID,
			coreName;

		var headerGen = function (text) {
			return function () {
				console.log("");
				console.log("========================================");
				console.log(text);
				console.log("");

				return when.resolve();
			}
		};
		var subHeaderGen = function (text) {
			return function () {
				console.log("");
				console.log("----------------------");
				console.log(text);
				console.log("");

				return when.resolve();
			}
		};

		if (shortcut && (shortcut == "wifi")) {
			return serial.configureWifi(null, null, that.options.scan);
		}

		var allDone = pipeline([

			headerGen("Setup your account"),


			//already logged in or not?
			function () {
				if (settings.access_token) {
					var inAs = (settings.username) ? " as " + settings.username : "";
					var line = "You are already logged in" + inAs + "\nDo you want to switch accounts? (y/N): ";
					return prompts.askYesNoQuestion(line, true);
				}
				else {
					//already logged out
					return when.resolve(true);
				}
			},


			//1.) prompt for user/pass,
			//1a - check if account exists, prompt to create an account
			//2.) confirm pass,
			//3.) create user,

			function(switchAccounts) {
				if (settings.access_token && switchAccounts) {
					return cloud.logout(true);
				}
				else {
					return when.resolve();
				}
			},

			function () {
				settings = settings.loadOverrides();
				if (!settings.access_token) {
					//need to login
					return that.login_or_create_account(api);
				}
				else {
					//already / still logged in
					return when.resolve();
				}
			},
			function () {
				var token = api.getToken();
				if (!token) {
					return when.reject("Unable to login or create a new account");
				}

				console.log("Logged in!  Saving access token: " + token);
				settings.override(null, "access_token", token);
				return when.resolve();
			},

			subHeaderGen("Finding your core id"),


			//4.) connect core blinking blue,
			//5.) grab core identity,

			function () {
				if (!serial) {
					return when.reject("Couldn't find serial module");
				}

				var getCoreID = function () {
					return serial.identifyCore();
				};
				var recoveryFn = function () {

					console.log("Press and hold the MODE button until your core blinks solid blue");
					console.log("");
					return prompts.promptDfd(" - Is your core blinking blue?  Then press ENTER - ");
				};

				return utilities.retryDeferred(getCoreID, 3, recoveryFn);
			},

			function (serialID) {
				if (!serialID) {
					console.log("I couldn't find your core ID, sorry!");
					return when.reject("Couldn't get core ID");
				}

				//console.log("It looks like your core id is: " + serialID);
				coreID = serialID;

				return when.resolve();
			},

			headerGen("Setup your wifi"),


			//6.) prompt for / configure wifi creds,
			function () {
				var configWifi = function () {
					//console.log("Make sure your core is blinking blue (in listening mode) and is connected to your computer");
					return serial.configureWifi(null, true);
				};
				return utilities.retryDeferred(configWifi, 3);
			},

			function () {
				console.log("");
				return prompts.promptDfd("Please wait until your core is breathing cyan and then press ENTER\n");
			},

			headerGen("Claiming your core"),


			//7.) claim core,
			function () {
				var tryFn = function () {
					return api.claimCore(coreID);
				};
				var recoveryFn = function () {
					return prompts.promptDfd("Please wait until your core is breathing cyan and then press ENTER\n");
				};
				return utilities.retryDeferred(tryFn, 5, recoveryFn);
			},

			function () {
				api.signalCore(coreID, true);
				return when.resolve();
			},

			headerGen("Shouting rainbows..."),
			function () {
				return prompts.promptDfd("Press ENTER if your core is excitedly shouting rainbows");
			},

			function () {
				var lines = [
					"                                 ,---. ",
					",--.   ,--.             ,--.     |   | ",
					" \\  `.'  /,---.  ,--,--.|  ,---. |  .' ",
					"  '.    /| .-. :' ,-.  ||  .-.  ||  |  ",
					"    |  | \\   --.\\ '-'  ||  | |  |`--'  ",
					"    `--'  `----' `--`--'`--' `--'.--.  ",
					"                                 '--'  ",
					""];
				console.log(lines.join("\n"));
				return when.resolve();
			},


			subHeaderGen("Naming your core"),


			//8.) name your core!
			function () {
				return prompts.promptDfd("What would you like to call your core? ");
			},
			function (name) {
				coreName = name;
				api.signalCore(coreID, false);
				return api.renameCore(coreID, name);
			},

			headerGen("Success!"),


			function () {
				return prompts.askYesNoQuestion("Do you want to logout  now? (y/n): ", true);
			},
			function (shouldLogout) {
				if (shouldLogout) {
					console.log("Logging out?");
					return cloud.logout();
				}
				return when.resolve();
			}
		]);

		//optional
		//8.) prompt for open web browser to spark/build
		//9.) prompt for open web browser to spark/docs


		when(allDone).then(function () {
				settings = settings.loadOverrides();

				console.log("You've successfully setup your core: " + coreName + " (" + coreID + ")");
				console.log("");
				console.log("Nice work " + settings.username + "!");
				console.log("");

				setTimeout(function () {
					process.exit(-1);
				}, 1250);
			},
			function (err) {
				console.error("Error setting up your core: " + err);
				process.exit(-1);
			});


	},


	/**
	 * tries to login, or if that fails, prompt for the password again, and then create an account
	 * @param api
	 */
	login_or_create_account: function (api) {

		//TODO: make this function more pretty
		var username;

		return pipeline([
			function () {
				return prompts.getCredentials()
			},
			//login to the server
			function (creds) {
				var tmp = when.defer();

				username = creds[0];
				if (!username || (username == '')
					|| (!utilities.contains(username, "@"))
					|| (!utilities.contains(username, "."))) {
					tmp.reject("Username must be an email address.");
					return tmp.promise;
				}

				console.log("");
				console.log("Trying to login...");

				var loginDone = api.login("spark-cli", creds[0], creds[1]);
				when(loginDone).then(
					function (token) {
						if (username) {
							settings.override(null, "username", username);
						}

						//login success
						tmp.resolve(token);
					},
					function () {

						var username = creds[0];
						if (!username || (username == '')
							|| (!utilities.contains(username, "@"))
							|| (!utilities.contains(username, "."))) {
							tmp.reject("Username must be an email address.");
							return;
						}

						console.log("Login failed, Lets create a new account!");


						//create account
						var createAccountDone = pipeline([
							function () {
								return prompts.confirmPassword();
							},
							function (pass) {
								if (pass != creds[1]) {
									return when.reject("Passwords did not match! ");
								}
								else {
									return when.resolve();
								}
							},
							//TODO: prompt to make sure they want to create a new account?
							function () {
								return api.createUser(creds[0], creds[1]);
							},
							function() {
								//cool, lets login then.
								return api.login("spark-cli", creds[0], creds[1]);
							},
							function (token) {
								if (username) {
									settings.override(null, "username", username);
								}

								//login success
								return when.resolve(token);
							}
						]);
						utilities.pipeDeferred(createAccountDone, tmp);
					});

				return tmp.promise;
			}
		]);
	},


	checkArguments: function(args) {
		this.options = this.options || {};

		if (!this.options.scan) {
			this.options.scan = utilities.tryParseArgs(args,
				"--scan",
				null
			);
		}
	},


	_: null
});

module.exports = SetupCommand;
