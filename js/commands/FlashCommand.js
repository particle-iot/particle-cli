/**
 ******************************************************************************
 * @file    js/commands/FlashCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Flash commands module
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
var fs = require('fs');
var settings = require('../settings.js');
var path = require('path');

var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var fs = require('fs');
var dfu = require('../lib/dfu.js');

var FlashCommand = function (cli, options) {
    FlashCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(FlashCommand, BaseCommand);
FlashCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "flash",
    description: "copies firmware and data to your core over usb",

    init: function () {
        this.addOption("firmware", this.flashCore.bind(this), "Flashes a local firmware binary to your core over USB");
        //this.addOption("list", this.listCores.bind(this));
        //this.addOption(null, this.helpCommand.bind(this));
    },

    flashCore: function(firmware) {
        if (!firmware || !fs.existsSync(firmware)) {
            console.log("Please specify a firmware file to flash locally to your core ");
            return -1;
        }

        var ready = sequence([
            function () {
                return dfu.findCompatiableDFU();
            },
            function() {
                return dfu.writeFirmware(firmware, true);
            }
        ]);

        when(ready).then(function () {
            console.log("Flashed!");
        }, function (err) {
            console.error("Error writing firmware... " + err);
        });

        return 0;
    },


    _: null
});

module.exports = FlashCommand;
