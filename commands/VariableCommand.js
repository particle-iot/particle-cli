/**
 ******************************************************************************
 * @file    commands/VariableCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
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
var _ = require('lodash');

var sequence = require('when/sequence');
var readline = require('readline');
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var utilities = require('../lib/utilities.js');
var BaseCommand = require('./BaseCommand.js');
var ApiClient = require('../lib/ApiClient.js');
var moment = require('moment');
var inquirer = require('inquirer');
var prompt = inquirer.prompt;

var VariableCommand = function (cli, options) {
	VariableCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(VariableCommand, BaseCommand);
VariableCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "variable",
	description: "retrieve and monitor variables on your device",


	init: function () {
		this.addOption("list", this.listVariables.bind(this), "Show variables provided by your device(s)");
		this.addOption("get", this.getValue.bind(this), "Retrieve a value from your device");
		this.addOption("monitor", this.monitorVariables.bind(this), "Connect and display messages from a device");

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


	disambiguateGetValue: function (deviceId, variableName) {
		//if their deviceId actually matches a device, list those variables.
		//if their deviceId is null, get that var from the relevant devices

		//this gets cached after the first request
		return this.getAllVariables().then(function (devices) {
			if (deviceId) {
				var device = _.findWhere(devices, {id: deviceId});
				if (!device) {
					return when.reject('No matching device');
				}

				return when.promise(function (resolve, reject) {
					prompt([{
						type: 'list',
						name: 'variableName',
						message: 'Which variable did you want?',
						choices: function () {
							return _.map(device.variables, function (type, key) {
								return {
									name: util.format('%s (%s)', key, type),
									value: key
								};
							});
						}
					}], function (answers) {
						resolve({ deviceIds: [deviceId], variableName: answers.variableName });
					});
				});
			}

			var deviceIds = _.pluck(_.filter(devices, function (c) {
				return _.has(c.variables, variableName);
			}), 'id');
			return { deviceIds: deviceIds, variableName: variableName };
		});
	},

	_getValue: function(coreid, variableName) {
		var tmp = when.defer();
		var that = this;
		if (!util.isArray(coreid)) {
			coreid = [ coreid ];
		}

		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return;
		}

		var multipleCores = coreid.length > 1;

		return when.map(coreid, function (coreid) {
			return api.getVariable(coreid, variableName);
		}).then(function (results) {
			var time = moment().format()
			for (var i = 0; i < results.length; i++) {

				var parts = [];
				try {
					var result = results[i];
					if (multipleCores) {
						parts.push(result.coreInfo.deviceID);
					}
					if (that.options.showTime) {
						parts.push(time);
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
			throw err;
		});
	},

	getValue: function (deviceId, variableName) {
		this.checkArguments(arguments);
		var self = this;

		if (!deviceId && !variableName) {
			//they just didn't provide any args...
			return this.listVariables();
		}
		else if (deviceId && !variableName) {
			//try to figure out if they left off a variable name, or if they want to pull a var from all cores.
			return this.disambiguateGetValue(deviceId).then(function (result) {
				return self._getValue(result.deviceIds, result.variableName);
			});
		}
		else if (deviceId == 'all' && variableName) {
			return this.disambiguateGetValue(null, variableName).then(function (result) {
				return self._getValue(result.deviceIds, result.variableName);
			});;
		}

		return this._getValue(deviceId, variableName);		
	},


	getAllVariables: function (args) {
		if (this._cachedVariableList) {
			return when.resolve(this._cachedVariableList);
		}

		console.error("polling server to see what devices are online, and what variables are available");

		var that = this;
		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return;
		}

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

				return when.all(promises).then(function (cores) {
					//sort alphabetically
					cores = cores.sort(function (a, b) {
						return (a.name || "").localeCompare(b.name);
					});

					that._cachedVariableList = cores;
					return cores;
				});
			}
		};

		return pipeline([
			api.listDevices.bind(api),
			lookupVariables
		]);
	},


	listVariables: function (args) {
		this.getAllVariables(args).then(function (cores) {
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


	monitorVariables: function (deviceId, variableName, delay) {
		var self = this;
		if (!deviceId && !variableName) {
			console.log('Please specify a device id (or all) and a variable name.');
			return;
		}
		this.checkArguments(arguments);

		function disambiguate() {
			if (deviceId === 'all') {
				deviceId = null;
			}
			if (!deviceId || !variableName) {
				return self.disambiguateGetValue(deviceId, variableName);
			}
			return when.resolve({ deviceIds: [deviceId], variableName: variableName });
		}

		disambiguate().then(function (result) {
			if (delay < settings.minimumApiDelay) {
				delay = settings.minimumApiDelay;
				console.error('Delay was too short, resetting to %dms', settings.minimumApiDelay);
			}
			console.error('Hit CTRL-C to stop!');

			function checkVariable() {
				self._getValue(result.deviceIds, result.variableName).ensure(function () {
					setTimeout(checkVariable, delay);
				});
			}
			checkVariable();
		}).catch(function (err) {
			console.error(err);
		});
	}
});

module.exports = VariableCommand;
