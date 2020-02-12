const os = require('os');
const VError = require('verror');
const ParticleAPI = require('./api');
const LegacyApiClient = require('../lib/api-client');
const spinnerMixin = require('../lib/spinner-mixin');
const settings = require('../../settings');
const UI = require('../lib/ui');

const { normalizedApiError } = LegacyApiClient;


module.exports = class FunctionCommand {
	constructor({
		stdin = process.stdin,
		stdout = process.stdout,
		stderr = process.stderr
	} = {}){
		this.stdin = stdin;
		this.stdout = stdout;
		this.stderr = stderr;
		this.ui = new UI({ stdin, stdout, stderr });
		spinnerMixin(this);
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
		let msg = `Calling function ${fn} from device ${device}`;

		if (product){
			msg += ` in product ${product}`;
		}

		const fetchVar = createAPI().callFunction(device, fn, arg, product);
		return this.showBusySpinnerUntilResolved(msg, fetchVar)
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


