const VError = require('verror');
const settings = require('../../settings');
const ParticleAPI = require('./api');
const { normalizedApiError } = require('../lib/api-client');
const spinnerMixin = require('../lib/spinner-mixin');
const { JSONResult } = require('../lib/json-result');
const UI = require('../lib/ui');


module.exports = class ProductCommand {
	constructor({
		stdin = process.stdin,
		stdout = process.stdout,
		stderr = process.stderr
	} = {}) {
		this.stdin = stdin;
		this.stdout = stdout;
		this.stderr = stderr;
		this.ui = new UI({ stdin, stdout, stderr });
		spinnerMixin(this);
	}

	showDeviceDetail({ json, params: { product, device } }){
		const msg = `Fetching device ${device} detail`;
		const fetchData = createAPI().getDeviceAttributes(device, product);
		return (json ? fetchData : this.showBusySpinnerUntilResolved(msg, fetchData))
			.then(res => {
				if (json){
					this.ui.stdout.write(
						this.createJSONResult(null, res)
					);
				} else {
					this.ui.logDeviceDetail(res);
				}
			})
			.catch(error => {
				const message = 'Error showing product device detail';
				throw this.createErrorResult({ error, message, json });
			});
	}

	showDeviceList({ name, page = 1, limit, groups, json, params: { product, device } }){
		if (device){
			return this.showDeviceDetail({ json, params: { product, device } });
		}
		const msg = `Fetching product ${product} device list`;
		const fetchData = createAPI().listDevices({ product, page, groups, perPage: limit, deviceName: name });
		return (json ? fetchData : this.showBusySpinnerUntilResolved(msg, fetchData))
			.then(res => {
				if (json){
					this.ui.stdout.write(
						this.createJSONResult(page, res.devices)
					);
				} else {
					this.ui.logDeviceDetail(res.devices);
				}
			})
			.catch(error => {
				const message = 'Error listing product devices';
				throw this.createErrorResult({ error, message, json });
			});
	}

	createJSONResult(page, data){
		const meta = typeof page === 'number'
			? { previous: page - 1, current: page, next: page + 1 }
			: {};

		return new JSONResult(meta, data).toString();
	}

	createErrorResult({ error: e, message, json }){
		const error = new VError(normalizedApiError(e), message);
		error.asJSON = json;
		return error;
	}
};


// UTILS //////////////////////////////////////////////////////////////////////
function createAPI(){
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}
