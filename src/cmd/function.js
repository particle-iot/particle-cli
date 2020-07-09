const os = require('os');
const VError = require('verror');
const ParticleAPI = require('./api');
const LegacyApiClient = require('../lib/api-client');
const settings = require('../../settings');
const CLICommandBase = require('./base');

const { normalizedApiError } = LegacyApiClient;


module.exports = class FunctionCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	listFunctions(){
		const api = new LegacyApiClient();
		api.ensureToken();

		return api.getAllAttributes()
			.then(devices => this.ui.logDeviceDetail(devices, { fnsOnly: true }))
			.catch(err => {
				throw new VError(normalizedApiError(err), 'Error while listing variables');
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

		const fetchVar = createAPI().callFunction(device, fn, arg, product);
		return this.ui.showBusySpinnerUntilResolved(msg, fetchVar)
			.then(res => {
				if (!res || !res.hasOwnProperty('return_value')){
					throw res;
				}
				this.ui.stdout.write(`${res.return_value}${os.EOL}`);
			})
			.catch(error => {
				let message = `Error calling function: \`${fn}\``;

				if (error && error.statusCode === 404){
					message = `Function call failed: Function \`${fn}\` not found`;
				}
				throw createAPIErrorResult({ error, message });
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


