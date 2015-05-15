/**
 ******************************************************************************
 * @file    lib/prompts.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Prompts module
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
var sequence = require('when/sequence');
var readline = require('readline');

var inquirer = require('inquirer');

var that = {

	_prompt: null,

	/**
	 * Sets up our user input
	 */
	getPrompt: function () {
		if (!that._prompt) {
			that._prompt = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
		}
		return that._prompt;
	},

	closePrompt: function() {
		if (that._prompt) {
			that._prompt.close();
			that._prompt = null;
		}
	},

	promptDfd: function (message) {
		var dfd = when.defer();
		var prompt = that.getPrompt();
		prompt.question(message, function (value) {
			dfd.resolve(value);
		});
		return dfd.promise;
	},
	askYesNoQuestion: function (message, alwaysResolve) {
		var dfd = when.defer();
		var prompt = that.getPrompt();
		prompt.question(message, function (value) {
			value = (value || "").toLowerCase();
			var saidYes = ((value == "yes") || (value == "y"));

			if (alwaysResolve) {
				dfd.resolve(saidYes);
			}
			else if (saidYes) {
				dfd.resolve(value);
			}
			else {
				dfd.reject(value);
			}
		});
		return dfd.promise;
	},

	passPromptDfd: function (message) {
		var dfd = when.defer();

		//kill the existing prompt
		that.closePrompt();

		var stdin = process.openStdin();
		stdin.setRawMode(true);
		process.stdin.setRawMode(true);
		process.stdout.write(message);

		var arr = [];
		var onStdinData = function(chunk) {
			if ((chunk[0] == 8) || (chunk[0] == 127)) {
				if (arr.length > 0) {
					arr.pop();
					process.stdout.write('\b \b');
				}
			}
			else if (chunk[0] == 3) {
				process.stdout.write("\nBreak!\n");
				dfd.reject("break");
			}
			else if (chunk[0] != 13) {
				arr.push(chunk);
				process.stdout.write("*");
			}
			else {
				process.stdout.write("\n");
				dfd.resolve(arr.join(''));
			}
		};
		stdin.on('data', onStdinData);

		when(dfd.promise).ensure(function() {
			process.stdin.setRawMode(false);
			stdin.removeListener('data', onStdinData);
		});

		return dfd.promise;
	},

	areYouSure: function() {
		return that.askYesNoQuestion("Are you sure?  Please Type yes to continue: ");
	},

	getCredentials: function (username) {
		var creds = when.defer();

		inquirer.prompt([
			that.getUsername(username),
			that.getPassword()
		], function(answers) {
			creds.resolve(answers);
		});

		return creds.promise;
	},
	getUsername: function (username) {
		return {
			type: 'input',
			name: 'username',
			message: 'Please enter your email address',
			default: username,
			validate: function(value) {
				if (!value) {
					return 'You need an email address to log in, silly!';
				}
				return true;
			}
		};
	},
	getPassword: function (msg) {
		return {
			type: 'password',
			name: 'password',
			message: msg || 'Please enter your password',
			validate: function(value) {
				if (!value) {
					return 'You need a password to log in, silly!';
				}
				return true;
			}
		};
	},
	confirmPassword: function () {
		return that.passPromptDfd("confirm password  ");
	},

	getNewCoreName: function () {
		return that.promptDfd("How shall your device be known? (name?):\t");
	},

	hitEnterWhenReadyPrompt: function () {
		console.log("");
		console.log("");
		console.log("");
		return that.promptDfd("If it isn't too much trouble, would you mind hitting ENTER when you'd like me to start?");
	},

	hitEnterWhenCyanPrompt: function () {
		console.log("");
		console.log("");
		return that.promptDfd("Sorry to bother you again, could you wait until the light is CYAN and then press ENTER?");
	},


	waitFor: function (delay) {
		var temp = when.defer();

		console.log('...(pausing for effect:' + delay + ').');
		setTimeout(function () { temp.resolve(); }, delay);
		return temp.promise;
	},



	foo: null
};
module.exports = that;
