/**
 ******************************************************************************
 * @file    js/commands/VariableCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Cloud variables command module
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
var pipeline = require('when/pipeline');

var sequence = require('when/sequence');
var readline = require('readline');
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var utilities = require('../lib/utilities.js');
var BaseCommand = require("./BaseCommand.js");
var ApiClient = require('../lib/ApiClient.js');
var moment = require('moment');

var VariableCommand = function (cli, options) {
    VariableCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(VariableCommand, BaseCommand);
VariableCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "variable",
    description: "retrieve and monitor variables on your core",


    init: function () {
        this.addOption("list", this.listVariables.bind(this), "Show variables provided by your core(s)");
        this.addOption("get", this.getValue.bind(this), "Retrieve a value from your core");
        this.addOption("monitor", this.monitorVariables.bind(this), "Connect and display messages from a core");

        //this.addArgument("get", "--time", "include a timestamp")
        //this.addArgument("monitor", "--time", "include a timestamp")
        //this.addArgument("get", "--all", "gets all variables from the specified core")
        //this.addArgument("monitor", "--all", "gets all variables from the specified core")


        //this.addOption(null, this.helpCommand.bind(this));
    },

    checkArguments: function (args) {
        this.options = this.options || {};

        if (!this.options.showTime) {
            this.options.showTime = (utilities.contains(args, "--time"));
        }
//        if (!this.options.showAll) {
//            this.options.showAll = (utilities.contains(args, "--all"));
//        }
    },


    disambiguateGetValue: function (coreid, variableName) {
        //if their coreid actually matches a core, list those variables.
        //if their coreid matches a variable name, get that var from the relevant cores

        var tmp = when.defer();
        var that = this;

        //this gets cached after the first request
        when(this.getAllVariables()).then(function (cores) {

            for (var i = 0; i < cores.length; i++) {
                if (cores[i].id == coreid) {

                    console.log("Which variable did you want?");
                    for (var key in foundCore.variables) {
                        var type = foundCore.variables[key];
                        console.log("  " + key + " (" + type + ")");
                    }

                    tmp.resolve();
                    return;
                }
            }

            variableName = coreid + "";
            coreid = [];

            for (var i = 0; i < cores.length; i++) {
                //cores[i].variables is an object, so use containsKey
                if (utilities.containsKey(cores[i].variables, variableName)) {
                    coreid.push(cores[i].id);
                }
            }

            //console.log('found ' + coreid.length + ' cores with that variable');
            utilities.pipeDeferred(that.getValue(coreid, variableName), tmp);
        });

        return tmp.promise;
    },


    getValue: function (coreid, variableName) {
        this.checkArguments(arguments);

        if (!coreid && !variableName) {
            //they just didn't provide any args...
            return this.listVariables();
        }
        else if (coreid && !variableName) {
            //try to figure out if they left off a variable name, or if they want to pull a var from all cores.
            return this.disambiguateGetValue(coreid);
        }
        else if (coreid == "all" && variableName) {
            return this.disambiguateGetValue(variableName);
        }

        var tmp = when.defer();
        var that = this;
        if (!util.isArray(coreid)) {
            coreid = [ coreid ];
        }

        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;

        var multipleCores = coreid.length > 1;

        var allDone = when.map(coreid, function (coreid) {
            return api.getVariable(coreid, variableName);
        });

        when(allDone)
            .then(function (results) {
                for (var i = 0; i < results.length; i++) {

                    var parts = [];
                    try {
                        var result = results[i];
                        if (multipleCores) {
                            parts.push(result.coreInfo.deviceID);
                        }
                        if (that.options.showTime) {
                            parts.push(moment().format())
                        }
                        parts.push(result.result);
                    }
                    catch (ex) {
                        console.error("error " + ex);
                    }

                    console.log(parts.join(", "));
                }
                tmp.resolve(results);
            },
            function (err) {
                console.error("Error reading value ", err);
                tmp.reject(err);
            });

        return tmp.promise;
    },


    getAllVariables: function (args) {
        if (this._cachedVariableList) {
            return when.resolve(this._cachedVariableList);
        }

        console.log("polling server to see what cores are online, and what variables are available");

        var tmp = when.defer();
        var that = this;
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;

        var lookupVariables = function (cores) {
            if (!cores || (cores.length == 0)) {
                console.log("No cores found.");
                that._cachedVariableList = null;
            }
            else {
                var promises = [];
                for (var i = 0; i < cores.length; i++) {
                    var coreid = cores[i].id;
                    if (cores[i].connected) {
                        promises.push(api.getAttributes(coreid));
                    }
                    else {
                        promises.push(when.resolve(cores[i]));
                    }
                }

                when.all(promises).then(function (cores) {
                    //sort alphabetically
                    cores = cores.sort(function (a, b) {
                        return (a.name || "").localeCompare(b.name);
                    });

                    that._cachedVariableList = cores;
                    tmp.resolve(cores);
                });
            }
        };

        pipeline([
            api.listDevices.bind(api),
            lookupVariables
        ]);

        return tmp.promise;
    },


    listVariables: function (args) {
        when(this.getAllVariables(args)).then(function (cores) {
            var lines = [];
            for (var i = 0; i < cores.length; i++) {
                var core = cores[i];
                var available = [];
                if (core.variables) {
                    for (var key in core.variables) {
                        var type = core.variables[key];
                        available.push("  " + key + " (" + type + ")");
                    }
                }

                var status = core.name + " (" + core.id + ") has " + available.length + " variables ";
                if (available.length == 0) {
                    status += " (or is offline) ";
                }

                lines.push(status);
                lines = lines.concat(available);
            }
            console.log(lines.join("\n"));
        });
    },


    monitorVariables: function (coreid, variableName, delay) {
        //TODO:
//        if (!args || (args.length < 1)) {
//            console.log("Please specify which core ")
//        }

        //TODO: if no device id, list devices
        //TODO: if no variable name, list variables

        this.checkArguments(arguments);

        if (delay < settings.minimumApiDelay) {
            delay = settings.minimumApiDelay;
            console.log("Delay was too short, resetting to ", settings.minimumApiDelay);
        }
        console.log("Hit CTRL-C to stop!");

        var checkVariable = (function () {
            var done = this.getValue(coreid, variableName);
            when(done).ensure(function () {
                setTimeout(checkVariable, delay);
            });
        }).bind(this);
        checkVariable();
    },


    _: null
});

module.exports = VariableCommand;
