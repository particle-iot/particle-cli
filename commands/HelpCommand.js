/**
 ******************************************************************************
 * @file    commands/HelpCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   CLI Help module
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
var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var utilities = require('../lib/utilities.js');
var package_json = require('../package.json');

var HelpCommand = function (cli, options) {
	HelpCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(HelpCommand, BaseCommand);
HelpCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "help",
	description: "Help provides information on available commands in the cli",

	init: function () {
		//this.addOption("list", this.listCommandsSwitch.bind(this), "List commands available for that command");
		this.addOption("version", this.showVersion.bind(this), "Displays the CLI version");
		this.addOption("*", this.helpCommand.bind(this), "Provide extra information about the given command");
	},


	showVersion: function() {
		console.log(package_json.version);
	},

	/**
	 * Get more info on a specific command
	 * @param name
	 * @param subcmd
	 */
	helpCommand: function (name, subcmd) {
		//console.log("Deep help command got " + name);
		//console.log("");

		if (!name) {
			this.listCommandsSwitch();
			return;
		}

		var command = this.cli.findCommand(name);
		if (!command) {
			console.log("Sorry, no help available for '%s'", name);
			this.listCommandsSwitch();
			return;
		}

		//make a pretty string showing how to use this command, optionally plus a sub-command
		var cmdLine = "particle " + name;
		if (subcmd) {
			cmdLine += " " + subcmd;
		}

		var lines = [
			"NAME:",
			cmdLine,
			""
		];

		var descr = command.does;
		if (!descr && subcmd && command.descriptionsByName) {
			descr = command.descriptionsByName[subcmd];
		}

		if (!descr) {
			descr = command.description;
		}
		if (descr && !util.isArray(descr)) {
			descr = [ descr ];
		}

		if (descr) {
			lines.push("DOES: ");
			lines.push(utilities.indentLines(descr, " ", 4));
		}


		//
		//  Get Usage text if we have it
		//


		var usageText = null;

		if (subcmd && command.usagesByName && command.usagesByName[subcmd]) {
			usageText = command.usagesByName[subcmd];
		}
		else if (command.usage) {
			usageText = command.usage;
		}

		if (usageText) {
			if (!util.isArray(usageText)) {
				usageText = [ usageText ];
			}

			//lines.push("How to use this function ");
			lines.push("");
			lines.push("USE:");
			lines.push(utilities.indentLines(usageText, " ", 4));
		}


		//
		// If we didn't have usage text, then maybe we're a parent command
		//

		if (!usageText) {

			var cmds = command._commands;
			if (cmds) {
				lines.push("The following commands are available: ");

				for (var idx = 0; idx < cmds.length; idx++) {
					var subcmdname = cmds[idx];
					var subcmd = command[subcmdname];

					var line = "   particle " + name + " " + subcmdname;
					line = utilities.padRight(line, " ", 25) + " - " + subcmd.does;
					lines.push(line);
				}
			}
			else if (command.optionsByName) {
				lines.push("");

				for (var name in command.optionsByName) {
					var desc = command.descriptionsByName[name];
					var line = "    particle " + command.name + " " + name;
					line = utilities.padRight(line, " ", 25) + " - " + desc;
					lines.push(line);
				}
			}
		}


		lines.push("");
		lines.push("");
		console.log(lines.join("\n"));

	},

	listCommandsTable: function () {
		//console.log("help list commands command!");
		console.log("Welcome to the Particle Command line utility!");
		console.log('Version', package_json.version);
		console.log("");
		console.log("The following commands are available:");

		var appName = "particle",
			leftPad = 2,
			rightPad = 20;

		var commands = this.cli.getCommands();

		var results = [];
		for (var i = 0; i < commands.length; i++) {
			try {
				var c = commands[i];
				if (c.name != null) {
					var line = utilities.indentLeft(appName + " " + c.name, " ", leftPad);
					line = utilities.padRight(line, " ", rightPad) + " - " + c.description;

					results.push(line);
				}
			}
			catch (ex) {
				console.error("Error loading command " + ex);
			}
		}

		console.log(results.join("\n"));
	},


	listMappedCommands: function () {
		var lines = [
			"",
			"Welcome to the Particle Command line utility!",
			'Version ' + package_json.version,
			"https://github.com/spark/particle-cli",
			""
		];

		//not sure what I want this to be yet...
		var node = this.cli._commandsMap;
		if (node._templates && node._templates.help) {

			var template = node._templates.help;
			if (util.isArray(template)) {
				template = template.join("\n");
			}

			//since it's not || rarely used, lets load this sparingly.
			var hogan = require('hogan.js');
			var str = hogan.compile(template).render(node);
			lines.push(str);
		}
		else {
			lines.push("Usage: particle <command_name> <arguments> ");
			lines.push("Common Commands:");
			lines.push("");

			var commands = node._commands;
			var cmdList = utilities.wrapArrayText(commands, 60);
			for (var i = 0; i < cmdList.length; i++) {
				lines.push(utilities.indentLeft(cmdList[i], " ", 4));
			}
			lines.push("");

			var others = this.cli.getUnmappedTopLevelCommands();
			if (others && (others.length > 0)) {
				lines.push("Less Common Commands:");
				cmdList = utilities.wrapArrayText(others, 60);
				for (var i = 0; i < cmdList.length; i++) {
					lines.push(utilities.indentLeft(cmdList[i], " ", 4));
				}
				lines.push("");
			}

			lines.push("For more information Run: particle help <command_name>");
			lines.push("");
		}

		console.log(lines.join("\n"));
	},


	listCommandsSwitch: function (name) {
		if (this.cli.hasMappings()) {
			if (name) {
				//new style
				this.helpCommand(name);
			}
			else {
				//new style
				this.listMappedCommands();
			}

		}
		else {
			if (name) {
				this.helpCommand(name);
			}
			else {
				//old style
				this.listCommandsTable();
			}


		}

	},

	_: null
});

module.exports = HelpCommand;
