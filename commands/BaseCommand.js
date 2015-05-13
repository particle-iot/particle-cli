/**
 ******************************************************************************
 * @file    commands/BaseCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Base command class module
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
var util = require('util');
var extend = require('xtend');
var readline = require('readline');
var spinner = require('cli-spinner').Spinner;
var chalk = require('chalk');

spinner.setDefaultSpinnerString(spinner.spinners[7]); // spinners spinners spinner spinner spinner!

var BaseCommand = function (cli, options) {
	this.cli = cli;
	this.optionsByName = {};
	this.descriptionsByName = {};
	this.newSpin();
};

BaseCommand.prototype = {
	/**
	 * exposed by the help command
	 */
	name: null,
	description: null,


	getPrompt: function () {
		if (!this._prompt) {
			this._prompt = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
		}
		return this._prompt;
	},

	promptDfd: function (message) {
		var dfd = when.defer();
		var prompt = this.getPrompt();
		prompt.question(message, function (value) {
			dfd.resolve(value);
		});
		return dfd.promise;
	},
	passPromptDfd: function (message) {
		var dfd = when.defer();
		var prompt = this.getPrompt();

		//process.stdin.setRawMode(true);
		prompt.question(message, function (value) {
			//process.stdin.setRawMode(false);
			dfd.resolve(value);
		});
		return dfd.promise;
	},

	addOption: function (name, fn, desc) {
		this.optionsByName[name] = fn;
		this.descriptionsByName[name] = desc;
	},

	runCommand: function (args) {
		//default to wildcard
		var cmdName = "*";
		var cmdFn = this.optionsByName[cmdName];

		//or, if we have args, try to grab that command and run that instead
		if (args && (args.length >= 1)) {
			cmdName = args[0];

			if (this.optionsByName[cmdName]) {
				cmdFn = this.optionsByName[cmdName];
				args = args.slice(1);
			}
		}

		//run em if we got em.
		if (cmdFn) {
			if (!util.isArray(args))
			{
				args = [ args ];
			}

			return cmdFn.apply(this, args);
		}
		else {
			//no wildcard, and no function specified...

			//console.log('running help for command');
			return this.cli.runCommand("help", this.name);
		}
	},
	newSpin: function (str) {

		this.__spin = new spinner(str);

		return this.__spin;
	},
	startSpin: function () {

		this.__spin.start();
	},
	stopSpin: function () {

		this.__spin.stop(true);
	},
	error: function (str, exit) {

		var name = this.name;
		if(!str) { str = "Unknown error"; }
		str = "%s: " + str;

		console.log();
		console.log(chalk.bold.red('!'), chalk.bold.white(util.format(str, name)));
		if (exit || exit === undefined) {
			process.exit(1);
		}
	},
	_: null
};

var arrow = chalk.green('>');

module.exports = BaseCommand;