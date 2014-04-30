/**
 ******************************************************************************
 * @file    js/lib/interpreter.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
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
    handle: function (args) {
        if (!args || args.length == 2) {
            return this.runCommand("help");
        }
        else if (args.length >= 2) {
            return this.runCommand(args[2], args.slice(3));
        }
    },

    runCommand: function (name, args) {
        //console.log('looking for command ' + name);

        var c = null;
        if (this._commandsMap) {
            c = this.getMappedCommand(name);
            args = this.addMappedArgs(name, args);
        }
        else {
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

    findCommand: function (name) {
        if (!name) {
            name = "help";
        }

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

        return null;
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

    loadMappings: function (filename) {
        var data = this.tryReadMappings(filename);
        if (!data || !data._commands) {
            console.log("Mappings filename was " + filename + " but no mappings were present");
            return;
        }

        this._commandsMap = {
            _commands: data._commands,
            _templates: data._templates
        };

        this.addMappedList(data._commands, data, this._commandsMap);

        //console.log("all done!", JSON.stringify(this._commandsMap, null, 2));
    },

    addMappedList: function (arr, tree, commands) {
        var names = [];
        for (var i = 0; i < arr.length; i++) {
            var name = arr[i];
            var node = tree[name];

            names.push(name);
            this.addMapping(name, node, commands);
            commands._commands = names;
        }
    },

    addMapping: function (name, node, commands) {
        if (!node) {
            return;
        }

        node.name = name;
        commands[name] = node;

        if (node._commands) {
            var subcommands = {
                // _parent: node
            };
            this.addMappedList(node._commands, node, subcommands);

            commands[name]._commands = subcommands;
            return;
        }

        var parent = (commands._parent) ? commands._parent.name : "";

        //console.log("would add " + parent + " " + name);
    },

    getMappedCommand: function (name) {
        var node = this._commandsMap[name];
        if (!node) {
            return null;
        }

        var cmdName = node.maps[0];

        //grab the command we're mapped to
        return this.commandsByName[cmdName];
    },
    addMappedArgs: function (name, args) {
        var node = this._commandsMap[name];
        if (!node) {
            return null;
        }

        //append any remaining chunks of the mapping to the arguments list
        if (node.maps.length > 1) {
            var arr = node.maps.slice(1);
            args = arr.concat(args);
        }
        return args;
    },

    hasMappings: function() {
        return !!this._commandsMap;
    },

    _: null
};
module.exports = Interpreter;

