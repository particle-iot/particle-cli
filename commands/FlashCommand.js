/**
 ******************************************************************************
 * @file    commands/FlashCommand.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Flash commands module
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
'use strict';

var when = require('when');
var sequence = require('when/sequence');

var extend = require('xtend');
var util = require('util');
var BaseCommand = require('./BaseCommand.js');
var fs = require('fs');
var dfu = require('../lib/dfu.js');
var utilities = require('../lib/utilities.js');
var ModuleParser = require('binary-version-reader').HalModuleParser;
var deviceSpecs = require('../lib/deviceSpecs');

var MONOLITHIC = 3;
var SYSTEM_MODULE = 4;
var APPLICATION_MODULE = 5;

var FlashCommand = function (cli, options) {
	FlashCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(FlashCommand, BaseCommand);
FlashCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: 'flash',
	description: 'copies firmware and data to your device over usb',

	init: function () {
		//this.addAlias("firmware", this.flashDfu.bind(this), null);

		this.addOption('firmware', this.flashDfu.bind(this), 'Flashes a local firmware binary to your device over USB');
		this.addOption('cloud', this.flashCloud.bind(this), 'Flashes a binary to your device wirelessly ');

		this.addOption('*', this.flashSwitch.bind(this));
		//this.addOption(null, this.helpCommand.bind(this));
	},

	checkArguments: function (args) {
		this.options = this.options || {};

		if (!this.options.knownApp) {
			this.options.knownApp = utilities.tryParseArgs(args,
				'--known',
				'Please specify an app name for --known'
			);
		}
		if (!this.options.useCloud) {
			this.options.useCloud = utilities.tryParseArgs(args,
				'--cloud',
				null
			);
		}
		if (!this.options.useDfu) {
			this.options.useDfu = utilities.tryParseArgs(args,
				'--usb',
				null
			);
		}
		if (!this.options.serial) {
			this.options.serial = utilities.tryParseArgs(args,
				'--serial',
				null
			);
		}
		if (!this.options.useFactoryAddress) {
			//assume DFU if doing factory
			this.options.useFactoryAddress = utilities.tryParseArgs(args,
				'--factory',
				null
			);
		}
		if (!this.options.force) {
			this.options.force = utilities.tryParseArgs(args,
				'--force',
				null
			);
		}
	},


	flashSwitch: function(deviceId, firmware) {
		if (!deviceId && !firmware) {
			var help = this.cli.getCommandModule('help');
			return help.helpCommand(this.name);
		}

		//particle flash --usb some-firmware.bin
		//particle flash --cloud core_name some-firmware.bin
		//particle flash core_name some-firmware.bin

		this.checkArguments(arguments);

		var result;
		if (this.options.useDfu || (deviceId === '--usb') || (deviceId === '--factory')) {
			result = this.flashDfu(this.options.useDfu || this.options.useFactoryAddress);
		} else if (this.options.serial) {
			result = this.flashYModem(this.options.serial);
		} else {
			//we need to remove the "--cloud" argument so this other command will understand what's going on.
			var args = Array.prototype.slice.call(arguments);
			if (this.options.useCloud) {
				//trim

				var idx = utilities.indexOf(args, '--cloud');
				args.splice(idx, 1);
			}

			result = this.flashCloud.apply(this, args);
		}

		return result;
	},

	flashCloud: function() {
		var cloud = this.cli.getCommandModule('cloud');
		return cloud.flashDevice.apply(cloud, arguments);
	},

	flashYModem: function() {
		var serial = this.cli.getCommandModule('serial');
		return serial.flashDevice.apply(serial, arguments);
	},

	flashDfu: function(firmware) {
		var useFactory = this.options.useFactoryAddress;

		var self = this;
		var specs, destSegment, destAddress;
		var flashingKnownApp = false;
		var ready = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function() {
				return dfu.findCompatibleDFU();
			},
			function() {
				//only match against knownApp if file is not found
				var stats;
				try {
					stats = fs.statSync(firmware);
				} catch (ex) {
					// file does not exist
					firmware = dfu.checkKnownApp(firmware);
					if (firmware === undefined) {
						return when.reject('file does not exist and no known app found.');
					} else {
						flashingKnownApp = true;
						return firmware;
					}
				}

				if (!stats.isFile()){
					return when.reject('You cannot flash a directory over USB');
				}
			},
			function() {
				destSegment = useFactory ? 'factoryReset' : 'userFirmware';
				if (flashingKnownApp) {
					return when.resolve();
				}

				return when.promise(function(resolve, reject) {
					var parser = new ModuleParser();
					parser.parseFile(firmware, function(info, err) {
						if (err) {
							return reject(err);
						}

						if (info.suffixInfo.suffixSize === 65535) {
							console.log('warn: unable to verify binary info');
							return resolve();
						}

						if (!info.crc.ok && !self.options.force) {
							return reject('CRC is invalid, use --force to override');
						}

						specs = deviceSpecs[dfu.deviceID];
						if (info.prefixInfo.platformID !== specs.productId && !self.options.force) {
							return reject(util.format('Incorrect platform id (expected %d, parsed %d), use --force to override', specs.productId, info.prefixInfo.platformID));
						}

						switch (info.prefixInfo.moduleFunction) {
							case MONOLITHIC:
								// only override if modular capable
								destSegment = specs.systemFirmwareOne ? 'systemFirmwareOne' : destSegment;
								break;
							case SYSTEM_MODULE:
								destAddress = '0x0' + info.prefixInfo.moduleStartAddy;
								break;
							case APPLICATION_MODULE:
								// use existing destSegment for userFirmware/factoryReset
								break;
							default:
								if (!self.options.force) {
									return reject('unknown module function ' + info.prefixInfo.moduleFunction + ', use --force to override');
								}
								break;
						}
						resolve();
					});
				});
			},
			function() {
				if (!destAddress && destSegment) {
					var segment = dfu._validateSegmentSpecs(destSegment);
					if (segment.error) {
						return when.reject('dfu.write: ' + segment.error);
					}
					destAddress = segment.specs.address;
				}
				if (!destAddress) {
					return when.reject('Unknown destination');
				}
				var alt = 0;
				var leave = destSegment === 'userFirmware';
				return dfu.writeDfu(alt, firmware, destAddress, leave);
			}
		]);

		return ready.then(function () {
			console.log ('\nFlash success!');
		}, function (err) {
			console.error('\nError writing firmware...' + err + '\n');
			return when.reject();
		});
	}
});

module.exports = FlashCommand;
