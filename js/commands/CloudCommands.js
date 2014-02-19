/**
 ******************************************************************************
 * @file    js/commands/CloudCommands.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Cloud commands module
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
var pipeline = require('when/pipeline');

var readline = require('readline');
var SerialPortLib = require("serialport");
var SerialPort = SerialPortLib.SerialPort;
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var prompts = require('../lib/prompts.js');
var ApiClient = require('../lib/ApiClient.js');
var fs = require('fs');
var path = require('path');
var moment = require('moment');

var CloudCommand = function (cli, options) {
    CloudCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(CloudCommand, BaseCommand);
CloudCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "cloud",
    description: "simple interface for common cloud functions",


    init: function () {
        this.addOption("claim", this.claimCore.bind(this), "Register a core with your user account with the cloud");
        this.addOption("remove", this.removeCore.bind(this), "Release a core from your account so that another user may claim it");
        this.addOption("name", this.nameCore.bind(this), "Give a core a name!");
        this.addOption("flash", this.flashCore.bind(this), "Pass a binary, source file, or source directory to a core!");
        this.addOption("compile", this.compileCode.bind(this), "Compile a source file, or directory using the cloud service");
        this.addOption("login", this.login.bind(this), "Lets you login to the cloud and stores an access token locally");
        this.addOption("logout", this.logout.bind(this), "Logs out your session and clears your saved access token");
    },

    claimCore: function (coreid) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;
        api.claimCore(coreid);
    },

    removeCore: function (coreid) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        when(prompts.areYouSure())
            .then(function (yup) {
                //TODO: replace with better interactive init
                var api = new ApiClient(settings.apiUrl);
                api._access_token = settings.access_token;

                api.removeCore(coreid).then(function () {
                        console.log("Okay!");
                        process.exit(0);
                    },
                    function (err) {
                        console.log("Didn't remove the core " + err);
                        process.exit(1);
                    });
            },
            function (err) {
                console.log("Didn't remove the core " + err);
                process.exit(1);
            });
    },

    nameCore: function (coreid, name) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        if (!name) {
            console.error("Please specify a name");
            return;
        }

        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;

        api.renameCore(coreid, name);
    },

    flashCore: function (coreid, filePath) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        if (!filePath) {
            console.error("Please specify a binary file, source file, or source directory");
            return;
        }

        if (!fs.existsSync(filePath)) {
            console.error("I couldn't find that: " + filePath);
            return;
        }


        var files = this._getFilesAtPath(filePath);
        if (!files) {
            return;
        }


        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;
        api.flashCore(coreid, files);
    },

    compileCode: function (filePath) {
        if (!filePath) {
            console.error("Please specify a binary file, source file, or source directory");
            return;
        }

        if (!fs.existsSync(filePath)) {
            console.error("I couldn't find that: " + filePath);
            return;
        }

        var files = this._getFilesAtPath(filePath);
        if (!files) {
            return;
        }

        var filename = "firmware_" + (new Date()).getTime() + ".bin";

        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;

        var allDone = pipeline([
            //compile
            function() { return api.compileCode(files); },

            //download
            function(resp) {
                if (resp && resp.binary_url) {
                    return api.downloadBinary(resp.binary_url, filename);
                }
                else {
                    //console.log("got back ", resp);
                    return when.reject("compile failed");
                }
            }
        ]);


        when(allDone).then(
            function () {
                console.log("saved firmware to " + filename);
                console.log("Compiled firmware downloaded.");
            },
            function (err) {
                console.error("Compile failed - ", err);
            });

    },

    login: function() {
        var allDone = pipeline([

            //prompt for creds
            prompts.getCredentials,

            //login to the server
            function(creds) {
                var api = new ApiClient(settings.apiUrl);
                return api.login("spark-cli", creds[0], creds[1]);
            }
        ]);

        when(allDone).then(function (access_token) {
                console.log("logged in! ", arguments);
                //console.log("Successfully logged in as " + username);
                settings.override("access_token", access_token);

                setTimeout(function() {
                    process.exit(-1);
                }, 2500);
            },
            function (err) {
                console.error("Error logging in " + err);
                process.exit(-1);
            });


    },
    logout: function() {
        settings.override("access_token", null);
        console.log("You're now logged out!");
    },

    _getFilesAtPath: function(filePath) {
        var files = {};
        var stats = fs.statSync(filePath);
        if (stats.isFile()) {
            files['file'] = filePath;
        }
        else if (stats.isDirectory()) {
            var dirFiles = fs.readdirSync(filePath);
            for (var i = 0; i < dirFiles.length; i++) {
                var filename = path.join(filePath, dirFiles[i]);
                var filestats = fs.statSync(filename);
                if (filestats.size > settings.MAX_FILE_SIZE) {
                    console.log("Skipping " + filename + " it's too big! " + stats.size);
                    continue;
                }

                if (i == 0) {
                    files['file'] = filename;
                }
                else {
                    files['file' + i] = filename;
                }
            }
        }
        else {
            console.log("was that a file or directory?");
            return false;
        }

        return files;
    },


    _: null
});

module.exports = CloudCommand;
