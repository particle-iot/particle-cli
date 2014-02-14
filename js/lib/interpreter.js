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

    startup: function () {
        this.loadCommands();

    },
    handle: function (args) {
        //console.log("DEBUG: Interpreter got args ", args);
        //console.log("");

        if (!args || args.length == 2) {
            return this.runCommand("help");
        }
        else if (args.length >= 2) {
            return this.runCommand(args[2], args.slice(3));
        }
    },

    runCommand: function(name, args) {
        //console.log('looking for command ' + name);
        var c = this.commandsByName[name];
        if (c) {
            //console.log("running runCommand");
            return c.runCommand(args);
        }
        else {
            console.log("Spark-CLI: Unknown command: \"" + name + "\"");
            return -1;
        }
    },

    getCommands: function() {
        return this._commands;
    },

    findCommand: function(name) {
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
    loadCommands: function() {
        this._commands = [];
        this.commandsByName = {};

        var files = fs.readdirSync(settings.commandPath).filter(function(file){
            return file.indexOf('.') !== 0; // Ignore hidden files (Such as .swp files)
        });

        for (var i = 0; i < files.length; i++) {
            var cmdPath = path.join(settings.commandPath, files[i]);
            try {
//                var fullPath = cmdPath;
                //var fullPath = path.join(settings.commandPath, cmdPath);
                //console.log('loading ' + fullPath);
                var Cmd = require(cmdPath);
                var c = new Cmd(this);



                if (c.name != null) {
                    this._commands.push(c);
                    this.commandsByName[c.name] = c;
                    //console.log("created a new command, ", c.name, ":", c.description);
                }
            }
            catch (ex) {
                console.error("Error loading command " + cmdPath + " " + ex);
            }
        }

    },


    _: null
};
module.exports = Interpreter;

