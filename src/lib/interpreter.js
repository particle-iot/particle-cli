/**
 ******************************************************************************
 * @file    lib/interpreter.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   CLI Interpreter module
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


const fs = require('fs');
const path = require('path');
const when = require('when');
const settings = require('../../settings.js');
const endsWith = require('./utilities').endsWith;

class Interpreter {

	constructor() {
		this._commands = null;
		this.commandsByName = null;
		this._commandsMap = null;
	}


	startup() {
		this.setupTerminal();
		this.loadCommands();

		if (settings.commandMappings) {
			this.loadMappings(settings.commandMappings);
		}
	}

	handle(args, shouldExit) {
		let result;

		if (!args || args.length === 2) {
			result = this.runCommand('help');
		} else if (args.length >= 2) {
			result = this.runCommand(args[2], args.slice(3));
		}

		if (when.isPromiseLike(result)) {
			result.done((res) => {
				process.exit(+res || 0);
			}, () => {
				if (shouldExit) {
					process.exit(1);
				}
			});
		} else {
			if (result !== undefined) {
				process.exit(result === 0 ? 0 : 1);
				return;
			}
		}
	}

	setupTerminal() {
		if (process.stdout._handle && process.stdout._handle.setBlocking) {
			process.stdout._handle.setBlocking(true);
		}
	}

	runCommand(name, args) {
		//console.log('looking for command ' + name);

		let c = null;
		if (this.hasMappings()) {
			c = this.getMappedCommand(name, args);
			let newargs = this.addMappedArgs(name, args);
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
		} else {
			console.log('particle: Unknown command: "' + name + '"');
			return -1;
		}
	}

	getCommands() {
		return this._commands;
	}

	/**
	 * ignores mappings, just uses the name in the original classfile,
	 * so we can cross-reference commands internally
	 * @param {String} name
	 * @returns {Object} command that matches
	 */
	getCommandModule(name) {
		let commands = this._commands;
		for (let i = 0; i < commands.length; i++) {
			let c = commands[i];
			if (c.name === name) {
				return c;
			}
		}
		throw Error('no command called '+name);
	}

	/**
	 * finds a command using the mapped name, or the friendly name in the module
	 * @param {String} name
	 * @returns {Object} command that matches
	 */
	findCommand(name) {
		if (!name) {
			name = 'help';
		}

		let cmd;
		if (this.hasMappings()) {
			cmd = this._commandsMap[name];
		}

		if (!cmd && (name !== 'help')) {
			return this.getCommandModule(name);
		}

		return cmd;
	}

	/**
	 * We could make this more efficient, but this is good for a small number
	 * of commands with lots of functionality
	 */
	loadCommands() {
		this._commands = [];
		this.commandsByName = {};

		let files = fs.readdirSync(settings.commandPath).filter((file) => {
			return file.indexOf('.') !== 0 && !endsWith(file, '.map'); // Ignore hidden files (Such as .swp files)
		});

		for (let i = 0; i < files.length; i++) {
			let cmdPath = path.join(settings.commandPath, files[i]);
			try {
				let Cmd = require(cmdPath);
				let c = new Cmd(this);

				if (c.name != null) {
					this._commands.push(c);
					this.commandsByName[c.name] = c;
				}
			} catch (ex) {
				console.error('Error loading command ' + cmdPath + ' ' + ex);
			}
		}
	}

	tryReadMappings(filename) {
		if (!filename || (filename === '')) {
			return null;
		}

		try {
			let contents = fs.readFileSync(filename);
			return JSON.parse(contents);
		} catch (ex) {
			console.error('Error parsing mappings file ' + filename, ex);
		}

		return null;
	}

	/**
	 * open our command mappings file, and override our stock commands
	 * @param {String} filename
	 */
	loadMappings(filename) {
		let data = this.tryReadMappings(filename);
		if (!data || !data._commands) {
			console.log('Mappings filename was ' + filename + ' but no mappings were present');
			return;
		}

		this._commandsMap = data;
	}

	getMappedCommand(name, args) {
		let node = this._commandsMap[name];
		if (!node) {
			return null;
		}

		//we don't map to anything, but there are more args?
		//maybe we're a root element.
		if (!node.maps && args && (args.length > 0)) {
			let subCmd = args[0];       //e.g. core add

			//does this root item have a subcommand with that name?
			if (node[subCmd]) {
				//what does that subcommand map to?
				let maps = node[subCmd].maps;

				let cmd = this.commandsByName[maps[0]];

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
			node.maps = ['help', name];
		}


		let cmdName = (node.maps) ? node.maps[0] : null;

		//grab the command we're mapped to
		return this.commandsByName[cmdName];
	}

	addMappedArgs(name, args) {
		let node = this._commandsMap[name];
		if (!node) {
			return null;
		}

		//append any remaining chunks of the mapping to the arguments list
		if (node.maps && (node.maps.length > 1)) {
			let arr = node.maps.slice(1);
			args = arr.concat(args);
		}
		return args;
	}

	hasMappings() {
		return !!this._commandsMap;
	}

	getUnmappedTopLevelCommands() {
		let results = [];

		let orig = this.commandsByName;
		for (let key in orig) {
			let obj = orig[key];

			let name = obj.name;
			if (!this._commandsMap[name]) {
				results.push(name);
			}
		}

		return results;
	}
}

module.exports = Interpreter;

