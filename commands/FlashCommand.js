/**
 ******************************************************************************
 * @file    commands/FlashCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
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
var settings = require('../settings.js');
var path = require('path');

var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var fs = require('fs');
var dfu = require('../lib/dfu.js');
var utilities = require('../lib/utilities.js');

var FlashCommand = function (cli, options) {
	FlashCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(FlashCommand, BaseCommand);
FlashCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "flash",
	description: "copies firmware and data to your device over usb",

	init: function () {
		//this.addAlias("firmware", this.flashDfu.bind(this), null);

		this.addOption("firmware", this.flashDfu.bind(this), "Flashes a local firmware binary to your device over USB");
		this.addOption("cloud", this.flashCloud.bind(this), "Flashes a binary to your device wirelessly ");

		this.addOption("*", this.flashSwitch.bind(this));
		//this.addOption(null, this.helpCommand.bind(this));
	},

	checkArguments: function (args) {
		this.options = this.options || {};

		if (!this.options.knownApp) {
			this.options.knownApp = utilities.tryParseArgs(args,
				"--known",
				"Please specify an app name for --known"
			);
		}
		if (!this.options.useCloud) {
			this.options.useCloud = utilities.tryParseArgs(args,
				"--cloud",
				null
			);
		}
		if (!this.options.useDfu) {
			this.options.useDfu = utilities.tryParseArgs(args,
				"--usb",
				null
			);
		}
		if (!this.options.useFactoryAddress) {
			//assume DFU if doing factory
			this.options.useFactoryAddress = utilities.tryParseArgs(args,
				"--factory",
				null
			);
		}
	},


	flashSwitch: function(coreid, firmware) {
		if (!coreid && !firmware) {
			var help = this.cli.getCommandModule("help");
			return help.helpCommand(this.name);
		}

		//particle flash --usb some-firmware.bin
		//particle flash --cloud core_name some-firmware.bin
		//particle flash core_name some-firmware.bin

		this.checkArguments(arguments);

		var result;
		if (this.options.useDfu || (coreid == "--usb") || (coreid == "--factory")) {
			result = this.flashDfu(this.options.useDfu || this.options.useFactoryAddress);
		}
		else {
			//we need to remove the "--cloud" argument so this other command will understand what's going on.
			var args = utilities.copyArray(arguments);
			if (this.options.useCloud) {
				//trim

				var idx = utilities.indexOf(args, "--cloud");
				args.splice(idx, 1);
			}

			result = this.flashCloud.apply(this, args);
		}

		return result;
	},

	flashCloud: function(coreid, filename) {
		var cloud = this.cli.getCommandModule("cloud");
		cloud.flashDevice.apply(cloud, arguments);
	},

	flashDfu: function(firmware) {

		//TODO: detect if arguments contain something other than a .bin file
		var useFactory = this.options.useFactoryAddress;

			var ready = sequence([
				function () {
					return dfu.findCompatibleDFU();
				},
				function () {
					//only match against knownApp if file is not found
					if (!fs.existsSync(firmware)){
						firmware = dfu.checkKnownApp(firmware);
						if (firmware === undefined) {
							return when.reject("no known App found.");
						} else {
							return firmware;
						}
					}
				},
				function () {
					if (useFactory) {
							return dfu.writeFactoryReset(firmware, false);
					}
					else {
							return dfu.writeFirmware(firmware, true);
					}
				}
			]);

		when(ready).then(function () {
			console.log ("\nFlash success!");
		}, function (err) {
			console.error("\nError writing firmware..." + err  + "\n");
			return -1;
		});



		return 0;
	},


	_: null
});

module.exports = FlashCommand;
