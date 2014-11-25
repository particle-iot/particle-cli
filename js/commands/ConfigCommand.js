/**
 ******************************************************************************
 * @file    js/commands/ConfigCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Config commands module
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
var settings = require('../settings.js');
var path = require('path');

var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var fs = require('fs');
var utilities = require('../lib/utilities.js');

var ConfigCommand = function (cli, options) {
    ConfigCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(ConfigCommand, BaseCommand);
ConfigCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "config",
    description: "helps create and switch between groups of commands",

    does: [
        "The config command lets you create groups of settings. ",
        "You can quickly switch to a profile by calling \"spark config profile-name\". ",
        "This is especially useful for switching to your local server ",
        "or when switching between other environments.  ",
        "Call \"spark config spark\" to switch back to the normal api server"
    ],
    usage: [
        "spark config local",
        "spark config spark",
        "spark config local apiUrl http://localhost:8080",
        "spark config useSudoForDfu true"
    ],


    init: function () {

        this.addOption("*", this.configSwitch.bind(this));
        this.addOption("identify", this.identifyServer.bind(this), "Display the current server config information.");
        //this.addOption(null, this.helpCommand.bind(this));
    },


    configSwitch: function (group, name, value) {
        if (!group && !name && !value) {
            var help = this.cli.getCommandModule("help");
            return help.helpCommand(this.name, null);
        }

        if (group && !name && !value) {
            //switch to that group
            this.switchGroup(group);
        }
        else if (group && name && !value) {
            this.changeSetting(null, group, name);
        }
        else if (group && name && value) {
            this.changeSetting(group, name, value);
        }
    },

    switchGroup: function (group) {
        //default group is spark
        if (!group) {
            group = "spark";
        }

        settings.switchProfile(group);
    },

    changeSetting: function (group, name, value) {
        settings.override(group, name, value);
    },
    
    identifyServer: function () {
        console.log("Current profile: " + settings.profile);
        console.log("IP address: " + settings.apiUrl);
    },

    _: null
});

module.exports = ConfigCommand;
