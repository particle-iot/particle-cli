const _ = require('lodash');
const VError = require('verror');
const moment = require('moment');
const prompt = require('inquirer').prompt;
const settings = require('../../settings');
const ApiClient = require('../lib/api-client');


module.exports = class VariableCommand {
	disambiguateGetValue({ deviceId, variableName }) {
		//if their deviceId actually matches a device, list those variables.
		//if their deviceId is null, get that var from the relevant devices

		//this gets cached after the first request
		return this.getAllVariables()
			.then((devices) => {
				if (deviceId) {
					const device = _.find(devices, (d) => {
						return d.id === deviceId || d.name === deviceId;
					});

					if (!device) {
						// see if any devices have a variable name matching value of deviceId
						variableName = deviceId;
						const maybeDeviceIds = _.map(_.filter(devices, (c) => {
							return _.has(c.variables, variableName);
						}), 'id');

						if (maybeDeviceIds.length === 0) {
							throw new VError('No matching device');
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

				const deviceIds = _.map(_.filter(devices, (c) => {
					return _.has(c.variables, variableName);
				}), 'id');

				return { deviceIds: deviceIds, variableName: variableName };
			});
	}

	_getValue(deviceId, variableName, { time }) {
		if (!_.isArray(deviceId)) {
			deviceId = [deviceId];
		}

		const api = new ApiClient();
		api.ensureToken();

		const multipleCores = deviceId.length > 1;
		const getVariables = deviceId.map((id) => api.getVariable(id, variableName));

		return Promise.all(getVariables)
			.then((results) => {
				const now = moment().format();
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

					if (time) {
						parts.push(now);
					}

					parts.push(result.result);
					console.log(parts.join(', '));
				}

				if (hasErrors) {
					throw new VError('Some variables could not be read');
				}

				return results;
			});
	}

	getValue(deviceId, variableName, { time }) {
		return Promise.resolve()
			.then(() => {
				if (!deviceId && !variableName) {
					//they just didn't provide any args...
					return this.listVariables();
				} else if (deviceId && !variableName) {
					//try to figure out if they left off a variable name, or if they want to pull a var from all devices.
					return this.disambiguateGetValue({ deviceId }).then(({ deviceIds, variableName }) => {
						return this._getValue(deviceIds, variableName, { time });
					});
				} else if (deviceId === 'all' && variableName) {
					return this.disambiguateGetValue({ variableName }).then(({ deviceIds, variableName }) => {
						return this._getValue(deviceIds, variableName, { time });
					});
				}

				return this._getValue(deviceId, variableName, { time });
			})
			.catch(err => {
				const api = new ApiClient();
				throw new VError(api.normalizedApiError(err), 'Error while reading value');
			});
	}

	getAllVariables() {
		if (this._cachedVariableList) {
			return Promise.resolve(this._cachedVariableList);
		}

		console.error('polling server to see what devices are online, and what variables are available');

		const api = new ApiClient();
		api.ensureToken();

		return Promise.resolve()
			.then(() => api.listDevices())
			.then(devices => {
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
							promises.push(Promise.resolve(devices[i]));
						}
					}

					return Promise.all(promises).then((devices) => {
						//sort alphabetically
						devices = devices.sort((a, b) => {
							return (a.name || '').localeCompare(b.name);
						});

						this._cachedVariableList = devices;
						return devices;
					});
				}
			});
	}


	listVariables() {
		return this.getAllVariables()
			.then((devices) => {
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
			})
			.catch(err => {
				const api = new ApiClient();
				throw new VError(api.normalizedApiError(err), 'Error while listing variables');
			});
	}

	monitorVariables(deviceId, variableName, { delay = settings.minimumApiDelay, time }) {
		return Promise.resolve()
			.then(() => {
				if (deviceId === 'all') {
					deviceId = null;
				}

				if (!deviceId || !variableName) {
					return this.disambiguateGetValue({ deviceId, variableName });
				}

				return { deviceIds: [deviceId], variableName: variableName };
			})
			.then(({ deviceIds, variableName }) => {
				if (delay < settings.minimumApiDelay) {
					delay = settings.minimumApiDelay;
					console.error(`Delay was too short, resetting to ${settings.minimumApiDelay}ms`);
				}

				console.error('Hit CTRL-C to stop!');

				const checkVariable = () => {
					this._getValue(deviceIds, variableName, { time })
						.finally(() => setTimeout(checkVariable, delay));
				};
				checkVariable();
			})
			.catch(err => {
				const api = new ApiClient();
				throw new VError(api.normalizedApiError(err), 'Error while monitoring variable');
			});
	}
};

