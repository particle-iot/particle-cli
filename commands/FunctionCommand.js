/**
 ******************************************************************************
 * @file    commands/FunctionCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Cloud functions command module
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

var FunctionCommand = function (cli, options) {
    FunctionCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(FunctionCommand, BaseCommand);
FunctionCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "function",
    description: "call functions on your device",

    init: function () {
        this.addOption("list", this.listFunctions.bind(this), "List functions provided by your device(s)");
        this.addOption("call", this.callFunction.bind(this), "Call a particular function on a device");
    },


    listFunctions: function (args) {
        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return;
        }

        when(api.getAllAttributes(args))
            .then(function (cores) {

                var lines = [];
                for (var i = 0; i < cores.length; i++) {

                    var core = cores[i];
                    var available = [];
                    if (core.functions) {

                        for (var idx = 0; idx < core.functions.length; idx++) {
                            var name = core.functions[idx];
                            available.push("  int " + name + "(String args) ");
                        }
                    }

                    var status = core.name + " (" + core.id + ") has " + available.length + " functions ";
                    if (available.length == 0) {
                        status += " (or is offline) ";
                    }

                    lines.push(status);
                    lines = lines.concat(available);
                }
                console.log(lines.join("\n"));
            });
    },

    callFunction: function (coreID, functionName, funcParam) {
        funcParam = funcParam || "";

        if (!coreID || !functionName) {
            //they just didn't provide any args...
            return this.listFunctions();
        }

        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return;
        }

        api.callFunction(coreID, functionName, funcParam).then(
            function (result) {
                if (result && result.error) {
                    console.log("Function call failed ", result.error);

                }
                else {
                    console.log(result.return_value);
                }



            },
            function (err) {
                console.log("Function call failed ", err);
            });
    },

    _: null
});

module.exports = FunctionCommand;
