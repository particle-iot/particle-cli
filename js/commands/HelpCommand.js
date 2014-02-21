/**
 ******************************************************************************
 * @file    js/commands/HelpCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
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
        this.addOption("list", this.listCommands.bind(this), "List commands available for that command");
        this.addOption("*", this.helpCommand.bind(this), "Provide extra information about the given command");
    },




    /**
     * Get more info on a specific command
     * @param name
     */
    helpCommand: function (name) {
        //console.log("Deep help command got " + name);
        //console.log("");

        if (!name) {
            this.listCommands();
            return;
        }

        var command = this.cli.findCommand(name);
        if (!command) {
            this.listCommands();
            return;
        }

        var results = [
            command.name + ":\t" + command.description,
            "the following commands are available: "
        ];
        for(var name in command.optionsByName) {
            var desc = command.descriptionsByName[name];
            var line = "   spark " + command.name + " " + name;
            line = utilities.padRight(line, " ", 25) + " - " + desc;
            results.push(line);
        }

        results.push("");
        results.push("");
        console.log(results.join("\n"));

    },

    listCommands: function () {
        //console.log("help list commands command!");
        console.log("Welcome to the Spark Command line utility!");
        console.log("");
        console.log("The following commands are available:");

        var commands = this.cli.getCommands();

        var results = [];
        for (var i = 0; i < commands.length; i++) {
            try {
                var c = commands[i];
                if (c.name != null) {
                    var line = "  spark " + c.name;
                    line = utilities.padRight(line, " ", 20) + " - " + c.description;

                    results.push(line);
                }
            }
            catch (ex) {
                console.error("Error loading command " + ex);
            }
        }

        console.log(results.join("\n"));
    },

    _: null
});

module.exports = HelpCommand;
