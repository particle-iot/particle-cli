const os = require('os');
const VError = require('verror');
const moment = require('moment');
const has = require('lodash/has');
const map = require('lodash/map');
const find = require('lodash/find');
const filter = require('lodash/filter');
const prompt = require('inquirer').prompt;
const settings = require('../../settings');
const LegacyApiClient = require('../lib/api-client');
const ParticleAPI = require('./api');
const CLICommandBase = require('./base');

const { normalizedApiError } = LegacyApiClient;


module.exports = class VariableCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	listVariables(){
		return this.getAllVariablesWithCache()
			.then(devices => this.ui.logDeviceDetail(devices, { varsOnly: true }))
			.catch(err => {
				throw new VError(normalizedApiError(err), 'Error while listing variables');
			});
	}

	getValue({ time, product, params: { device, variableName } }){
		if (product){
			if (!device){
				return this.showUsageError(
					'`device` parameter is required when `--product` flag is set'
				);
			}

			if (!variableName){
				return this.showUsageError(
					`\`variableName\` parameter is required when \`--product\` flag is set. To view available variables, run: particle product device list ${product}`
				);
			}
			let deviceId;
			return Promise.resolve().then(() => {
				if (this.isDeviceId(device)){
					deviceId = device;
				} else {
					return createAPI().listDevices({ deviceName: device, product }).then((results) => {
						const resultCount = results.meta.total_records;
						const matchingDevices = results.devices.filter((resultDevice) => {
							return resultDevice.name === device && !device.quarantined;
						});
						if (matchingDevices.length === 1){
							deviceId = matchingDevices[0].id;
						} else if(resultCount === 0){
							return this.showUsageError(
								`Device ${device} is not part of product ${product}. To view available devices, run: particle product device list ${product}`
							);
						} else {
							return this.showUsageError(
								`Device ${device} does not uniquely identify a device in in product ${product}. Ensure product devices have unique names or use device id to disambiguate. To view available devices, run: particle product device list ${product}`
							);
						}
					});
				}
			}).then(() => {
				const msg = `Fetching variable ${variableName} from device ${device} in product ${product}`;
				const fetchVar = createAPI().getVariable(deviceId, variableName, product);
				return this.showBusySpinnerUntilResolved(msg, fetchVar)
					.then(res => {
						this.ui.stdout.write(`${res.result}${os.EOL}`);
					})
					.catch(error => {
						const message = `Error fetching variable: \`${variableName}\``;
						throw createAPIErrorResult({ error, message });
					});
			});
		}

		return Promise.resolve()
			.then(() => {
				if (!device && !variableName){
					//they just didn't provide any args...
					return this.listVariables();
				} else if (device && !variableName){
					//try to figure out if they left off a variable name, or if they want to pull a var from all devices.
					return this.disambiguateGetValue({ device }).then(({ deviceIds, variableName }) => {
						return this._getValue(deviceIds, variableName, { time });
					});
				} else if (device === 'all' && variableName){
					return this.disambiguateGetValue({ variableName }).then(({ deviceIds, variableName }) => {
						return this._getValue(deviceIds, variableName, { time });
					});
				}

				return this._getValue(device, variableName, { time });
			})
			.catch(err => {
				const api = new LegacyApiClient();
				throw new VError(api.normalizedApiError(err), 'Error while reading value');
			});
	}

	_getValue(deviceId, variableName, { time }){
		if (!Array.isArray(deviceId)){
			deviceId = [deviceId];
		}

		const api = new LegacyApiClient();
		api.ensureToken();

		const multipleCores = deviceId.length > 1;
		const getVariables = deviceId.map((id) => api.getVariable(id, variableName));

		return Promise.all(getVariables)
			.then((results) => {
				const now = moment().format();
				let hasErrors = false;

				for (let i = 0; i < results.length; i++){
					const parts = [];
					const result = results[i];

					if (result.error){
						this.ui.stdout.write(`Error: ${result.error}${os.EOL}`);
						hasErrors = true;
						continue;
					}

					if (multipleCores){
						parts.push(result.coreInfo.deviceID);
					}

					if (time){
						parts.push(now);
					}

					parts.push(result.result);
					this.ui.stdout.write(`${parts.join(', ')}${os.EOL}`);
				}

				if (hasErrors){
					throw new VError('Some variables could not be read');
				}

				return results;
			});
	}

	monitorVariables({ time, delay = settings.minimumApiDelay, params: { device, variableName } }){
		return Promise.resolve()
			.then(() => {
				if (device === 'all'){
					device = null;
				}

				if (!device || !variableName){
					return this.disambiguateGetValue({ device, variableName });
				}
				return { deviceIds: [device], variableName };
			})
			.then(({ deviceIds, variableName }) => {
				if (delay < settings.minimumApiDelay){
					delay = settings.minimumApiDelay;
					this.ui.stderr.write(`Delay was too short, resetting to ${settings.minimumApiDelay}ms${os.EOL}`);
				}
				this.ui.stderr.write(`Hit CTRL-C to stop!${os.EOL}`);
				return this._pollForVariable(deviceIds, variableName, { delay, time });
			})
			.catch(err => {
				const api = new LegacyApiClient();
				throw new VError(api.normalizedApiError(err), 'Error while monitoring variable');
			});
	}

	_pollForVariable(deviceIds, variableName, { delay, time }){
		const retry = () => setTimeout(
			this._pollForVariable.bind(this, deviceIds, variableName, { delay, time }),
			delay
		);

		return this._getValue(deviceIds, variableName, { time })
			.then(retry)
			.catch(retry);
	}

	disambiguateGetValue({ device, variableName }){
		//if their deviceId actually matches a device, list those variables.
		//if their deviceId is null, get that var from the relevant devices

		//this gets cached after the first request
		return this.getAllVariablesWithCache()
			.then((deviceList) => {
				if (device){
					const deviceDetail = find(deviceList, (d) => {
						return d.id === device || d.name === device;
					});

					if (!deviceDetail){
						// see if any devices have a variable name matching value of deviceId
						const deviceIds = getIDs(deviceList, device);

						if (deviceIds.length === 0){
							throw new VError('No matching device');
						}
						return { deviceIds, variableName: device };
					}

					return prompt([{
						type: 'list',
						name: 'variableName',
						message: 'Which variable did you want?',
						choices: () => {
							return map(deviceDetail.variables, (type, key) => {
								return {
									name: `${key} (${type})`,
									value: key
								};
							});
						}
					}]).then((answers) => {
						return { deviceIds: [device], variableName: answers.variableName };
					});
				}

				const deviceIds = getIDs(deviceList, variableName);
				return { deviceIds, variableName };
			});

		function getIDs(deviceList, varName){
			return map(filter(deviceList, (c) => {
				return has(c.variables, varName);
			}), 'id');
		}
	}

	getAllVariablesWithCache(){
		if (this._cachedVariableList){
			return Promise.resolve(this._cachedVariableList);
		}

		this.ui.stderr.write(`polling server to see what devices are online, and what variables are available${os.EOL}`);

		const api = new LegacyApiClient();
		api.ensureToken();

		return Promise.resolve()
			.then(() => api.listDevices())
			.then(devices => {
				if (!devices || (devices.length === 0)){
					this.ui.stderr.write(`No devices found.${os.EOL}`);
					this._cachedVariableList = null;
				} else {
					const promises = [];
					for (let i = 0; i < devices.length; i++){
						const deviceid = devices[i].id;
						if (devices[i].connected){
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
};


// UTILS //////////////////////////////////////////////////////////////////////
function createAPI(){
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}

function createAPIErrorResult({ error: e, message, json }){
	const error = new VError(normalizedApiError(e), message);
	error.asJSON = json;
	return error;
}

