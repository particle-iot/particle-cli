/**
 ******************************************************************************
 * @file    commands/VariableCommand.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Cloud variables command module
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

const when = require('when');
const pipeline = require('when/pipeline');
const _ = require('lodash');

const settings = require('../../settings.js');
const ApiClient = require('../lib/ApiClient.js');
const moment = require('moment');
const prompt = require('inquirer').prompt;

class VariableCommand {
	constructor(options) {
		this.options = options;
	}

	disambiguateGetValue({ deviceId, variableName }) {
		//if their deviceId actually matches a device, list those variables.
		//if their deviceId is null, get that var from the relevant devices

		//this gets cached after the first request
		return this.getAllVariables().then((devices) => {
			if (deviceId) {
				const device = _.find(devices, (d) => {
					return d.id === deviceId || d.name === deviceId;
				});
				if (!device) {
					// see if any devices have a variable name matching value of deviceId
					variableName = deviceId;
					const maybeDeviceIds = _.pluck(_.filter(devices, (c) => {
						return _.has(c.variables, variableName);
					}), 'id');
					if (maybeDeviceIds.length === 0) {
						return when.reject('No matching device');
					}
					return { deviceIds: maybeDeviceIds, variableName: variableName };
				}

				return prompt([{
					type: 'list',
					name: 'variableName',
					message: 'Which variable did you want?',
					choices: () => {
						return _.map(device.variables, (type, key) => {
							return {
								name: `${key} (${type})`,
								value: key
							};
						});
					}
				}]).then((answers) => {
					return { deviceIds: [deviceId], variableName: answers.variableName };
				});
			}

			const deviceIds = _.pluck(_.filter(devices, (c) => {
				return _.has(c.variables, variableName);
			}), 'id');
			return { deviceIds: deviceIds, variableName: variableName };
		});
	}

	_getValue(deviceId, variableName) {
		if (!_.isArray(deviceId)) {
			deviceId = [deviceId];
		}

		const api = new ApiClient();
		if (!api.ready()) {
			return when.reject('Not logged in');
		}

		const multipleCores = deviceId.length > 1;

		return when.map(deviceId, (deviceId) => {
			return api.getVariable(deviceId, variableName);
		}).then((results) => {
			const time = moment().format();
			let hasErrors = false;
			for (let i = 0; i < results.length; i++) {
				const parts = [];
				const result = results[i];
				if (result.error) {
					console.log('Error:', result.error);
					hasErrors = true;
					continue;
				}

				if (multipleCores) {
					parts.push(result.coreInfo.deviceID);
				}
				if (this.options.time) {
					parts.push(time);
				}
				parts.push(result.result);

				console.log(parts.join(', '));
			}
			if (hasErrors) {
				return when.reject();
			}
			return when.resolve(results);
		}, (err) => {
			return when.reject(`Error reading value: ${err.message || err}`);
		});
	}

	getValue() {
		const deviceId = this.options.params.device;
		const variableName = this.options.params.variableName;

		if (!deviceId && !variableName) {
			//they just didn't provide any args...
			return this.listVariables();
		} else if (deviceId && !variableName) {
			//try to figure out if they left off a variable name, or if they want to pull a var from all devices.
			return this.disambiguateGetValue({ deviceId }).then(({ deviceIds, variableName }) => {
				return this._getValue(deviceIds, variableName);
			});
		} else if (deviceId === 'all' && variableName) {
			return this.disambiguateGetValue({ variableName }).then(({ deviceIds, variableName }) => {
				return this._getValue(deviceIds, variableName);
			});
		}

		return this._getValue(deviceId, variableName);
	}

	getAllVariables() {
		if (this._cachedVariableList) {
			return when.resolve(this._cachedVariableList);
		}

		console.error('polling server to see what devices are online, and what variables are available');

		const api = new ApiClient();
		if (!api.ready()) {
			return when.reject('Not logged in');
		}

		return pipeline([
			() => {
				return api.listDevices();
			},
			(devices) => {
				if (!devices || (devices.length === 0)) {
					console.log('No devices found.');
					this._cachedVariableList = null;
				} else {
					const promises = [];
					for (let i = 0; i < devices.length; i++) {
						const deviceid = devices[i].id;
						if (devices[i].connected) {
							promises.push(api.getAttributes(deviceid));
						} else {
							promises.push(when.resolve(devices[i]));
						}
					}

					return when.all(promises).then((devices) => {
						//sort alphabetically
						devices = devices.sort((a, b) => {
							return (a.name || '').localeCompare(b.name);
						});

						this._cachedVariableList = devices;
						return devices;
					});
				}
			}
		]);
	}


	listVariables(args = null) {
		// TODO: what is args
		return this.getAllVariables(args).then((devices) => {
			let lines = [];
			for (let i = 0; i < devices.length; i++) {
				const device = devices[i];
				const available = [];
				if (device.variables) {
					for (const key in device.variables) {
						const type = device.variables[key];
						available.push('  ' + key + ' (' + type + ')');
					}
				}

				let status = device.name + ' (' + device.id + ') has ' + available.length + ' variables ';
				if (available.length === 0) {
					status += ' (or is offline) ';
				}

				lines.push(status);
				lines = lines.concat(available);
			}
			console.log(lines.join('\n'));
		});
	}

	monitorVariables() {
		const deviceId = this.options.params.device;
		const variableName = this.options.params.variableName;
		const delay = this.options.delay;

		return this._monitorVariables({ deviceId, variableName, delay });
	}

	_monitorVariables({ deviceId, variableName, delay = settings.minimumApiDelay }) {
		return when.resolve().then(() => {
			if (deviceId === 'all') {
				deviceId = null;
			}
			if (!deviceId || !variableName) {
				return this.disambiguateGetValue({ deviceId, variableName });
			}
			return when.resolve({ deviceIds: [deviceId], variableName: variableName });
		}).then(({ deviceIds, variableName }) => {
			if (delay < settings.minimumApiDelay) {
				delay = settings.minimumApiDelay;
				console.error('Delay was too short, resetting to %dms', settings.minimumApiDelay);
			}
			console.error('Hit CTRL-C to stop!');

			const checkVariable = () => {
				this._getValue(deviceIds, variableName).ensure(() => {
					setTimeout(checkVariable, delay);
				});
			};
			checkVariable();
		});
	}
}

module.exports = VariableCommand;
