/**
 ******************************************************************************
 * @file    lib/interpreter.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   CLI Interpreter module
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

var fs = require('fs');
var path = require('path');
var when = require('when');
var settings = require('../settings.js');

var Interpreter = function () {

};
Interpreter.prototype = {
	_commands: null,
	commandsByName: null,
	_commandsMap: null,

	startup: function () {
		this.loadCommands();

		if (settings.commandMappings) {
			this.loadMappings(settings.commandMappings);
		}
	},
	handle: function (args, shouldExit) {
		var result;

		if (!args || args.length == 2) {
			result = this.runCommand("help");
		}
		else if (args.length >= 2) {
			result = this.runCommand(args[2], args.slice(3));
		}

		if (when.isPromiseLike(result)) {
			when(result).catch(function(err) {
				if (shouldExit) {
					process.exit(1);
				}
			});
		}
		else {
			return result;
		}
//        else {
//            if (shouldExit) {
//                process.exit(parseInt(result));
//            }
//            else {
//                return result;
//            }
//        }
	},

	runCommand: function (name, args) {
		//console.log('looking for command ' + name);

		var c = null;
		if (this.hasMappings()) {
			c = this.getMappedCommand(name, args);
			var newargs = this.addMappedArgs(name, args);
			if (c) {
				args = newargs;
			}
		}

		//allowing passthrough for things not mapped
		if (!c) {
			c = this.commandsByName[name];
		}


		if (c) {
			return c.runCommand(args);
		}
		else {
			console.log("Spark-CLI: Unknown command: \"" + name + "\"");
			return -1;
		}
	},

	getCommands: function () {
		return this._commands;
	},

	/**
	 * ignores mappings, just uses the name in the original classfile,
	 * so we can cross-reference commands internally
	 * @param name
	 * @returns {*}
	 */
	getCommandModule: function (name) {
		var commands = this._commands;
		for (var i = 0; i < commands.length; i++) {
			try {
				var c = commands[i];
				if (c.name == name) {
					return c;
				}
			}
			catch (ex) {
				console.error("Error loading command " + ex);
			}
		}
	},


	/**
	 * finds a command using the mapped name, or the friendly name in the module
	 * @param name
	 * @returns {*}
	 */
	findCommand: function (name) {
		if (!name) {
			name = "help";
		}

		var cmd;
		if (this.hasMappings()) {
			 cmd = this._commandsMap[name];
		}

		if (!cmd && (name != "help")) {
			return this.getCommandModule(name);
		}

		return cmd;
	},

	/**
	 * We could make this more efficient, but this is good for a small number
	 * of commands with lots of functionality
	 */
	loadCommands: function () {
		this._commands = [];
		this.commandsByName = {};

		var files = fs.readdirSync(settings.commandPath).filter(function (file) {
			return file.indexOf('.') !== 0; // Ignore hidden files (Such as .swp files)
		});

		for (var i = 0; i < files.length; i++) {
			var cmdPath = path.join(settings.commandPath, files[i]);
			try {
				var Cmd = require(cmdPath);
				var c = new Cmd(this);

				if (c.name != null) {
					this._commands.push(c);
					this.commandsByName[c.name] = c;
				}
			}
			catch (ex) {
				console.error("Error loading command " + cmdPath + " " + ex);
			}
		}
	},

	tryReadMappings: function (filename) {
		if (!filename || (filename == "")) {
			return null;
		}

		try {
			var contents = fs.readFileSync(filename);
			return JSON.parse(contents);
		}
		catch (ex) {
			console.error("Error parsing mappings file " + filename, ex);
		}

		return null;
	},

	/**
	 * open our command mappings file, and override our stock commands
	 * @param filename
	 */
	loadMappings: function (filename) {
		var data = this.tryReadMappings(filename);
		if (!data || !data._commands) {
			console.log("Mappings filename was " + filename + " but no mappings were present");
			return;
		}

		this._commandsMap = data;

		//tree recursive
//        this.addMappedList(data._commands, data, this._commandsMap);

		//TODO: DAVE HERE
		//optional?
		//make a list of all overridden / mapped commands, so we know not to list them?

		//
		//[ ] we should show a list of all missed commands under common commands, so that they can be found.
		//[ ] help should work for mappings containing children
		//e.g. core


	},
//
//    /**
//     * recur down the command tree, building our structure
//     * @param arr
//     * @param tree
//     * @param commands
//     */
//    addMappedList: function (arr, tree, commands) {
//        var names = [];
//        for (var i = 0; i < arr.length; i++) {
//            var name = arr[i];
//            var node = tree[name];
//
//            names.push(name);
//            this.addMapping(name, node, commands);
//            commands._commands = names;
//        }
//    },
//
//
//    addMapping: function (name, node, commands) {
//        if (!node) {
//            return;
//        }
//
//        node.name = name;
//        commands[name] = node;
//
//        if (node._commands) {
//            var subcommands = { };
//            this.addMappedList(node._commands, node, subcommands);
//            commands[name]._commands = subcommands;
//        }
//    },

	getMappedCommand: function (name, args) {
		var node = this._commandsMap[name];
		if (!node) {
			return null;
		}

		//we don't map to anything, but there are more args?
		//maybe we're a root element.
		if (!node.maps && args && (args.length > 0)) {
			var subCmd = args[0];       //e.g. core add

			//does this root item have a subcommand with that name?
			if (node[subCmd]) {
				//what does that subcommand map to?
				var maps = node[subCmd].maps;

				var cmd = this.commandsByName[maps[0]];

				//cut off the alias from the args, and inject the true command
				if (maps.length > 1) {
					args.splice(0, 1, maps[1]);
				}

				return cmd;
			}
		}


		if (!node.maps) {
			//doesn't map exactly to one command, so lets call help.
			//updating the maps property will let it trim the arguments later so we get the proper help command
			node.maps = [ "help", name ];
		}


		var cmdName = (node.maps) ? node.maps[0] : null;

		//grab the command we're mapped to
		return this.commandsByName[cmdName];
	},
	addMappedArgs: function (name, args) {
		var node = this._commandsMap[name];
		if (!node) {
			return null;
		}

		//append any remaining chunks of the mapping to the arguments list
		if (node.maps && (node.maps.length > 1)) {
			var arr = node.maps.slice(1);
			args = arr.concat(args);
		}
		return args;
	},

	hasMappings: function() {
		return !!this._commandsMap;
	},

	getUnmappedTopLevelCommands: function() {
		var results = [];

		var orig = this.commandsByName;
		for(var key in orig) {
			var obj = orig[key];

			var name = obj.name;
			if (!this._commandsMap[name]) {
				results.push(name);
			}
		}

		return results;
	},

//    getUnmappedCommands: function() {
//        var results = [];
//
//        var orig = this.cli.commandsByName;
//        for(var i=0;i<orig.length;i++) {
//            var name = orig[i].name;
//
//            if (!this._commandsMap[name]) {
//                results.push(name);
//            }
//        }
//
//        //what do I do about nested commands?
//
//        return results;
//    },

	_: null
};
module.exports = Interpreter;

