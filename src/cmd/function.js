'use strict';
const os = require('os');
const CLICommandBase = require('./base');


module.exports = class FunctionCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	listFunctions(){
		const { api } = this._particleApi();

		this.ui.stdout.write(`polling server to see what devices are online, and what functions are available${os.EOL}`);

		return api.listDevices()
			.then(devices => {
				if (!devices || devices.length === 0){
					// Match `device list` / `variable list`: a friendly message and a
					// clean exit, not a thrown error.
					this.ui.stdout.write(`No devices found.${os.EOL}`);
					return null;
				}
				return Promise.all(devices.map(d =>
					d.connected ? api.getDeviceAttributes({ deviceId: d.id }) : Promise.resolve(d)
				)).then(devices => devices.sort((a, b) => (a.name || '').localeCompare(b.name)))
					.then(devices => this.ui.logDeviceDetail(devices, { fnsOnly: true }));
			});
	}

	callFunction({ product, params: { device, function: fn, argument: arg } }){
		if (product){
			if (!this.isDeviceId(device)){
				return this.showProductDeviceNameUsageError(device);
			}
		}

		let msg = `Calling function ${fn} from device ${device}`;

		if (product){
			msg += ` in product ${product}`;
		}

		const { api } = this._particleApi();
		const fetchVar = api.callFunction({ deviceId: device, name: fn, argument: arg, product });
		return this.ui.showBusySpinnerUntilResolved(msg, fetchVar)
			.then(res => {
				if (!res || !Object.prototype.hasOwnProperty.call(res, 'return_value')){
					throw res;
				}
				this.ui.stdout.write(`${res.return_value}${os.EOL}`);
			})
			.catch(error => {
				if (error && error.statusCode === 404){
					throw new Error(`Function call failed: Function \`${fn}\` not found`);
				}
				// The API can resolve with `{ok: false, error: '...'}` for some
				// failure modes (which `then` re-throws as-is). Convert to a real
				// Error so the top-level handler can render a message.
				if (error && !(error instanceof Error) && error.error){
					throw new Error(error.error);
				}
				throw error;
			});
	}
};
