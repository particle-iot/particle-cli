const VError = require('verror');
const LegacyApiClient = require('../lib/api-client');
const ensureError = require('../lib/utilities').ensureError;
const spinnerMixin = require('../lib/spinner-mixin');
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

	callFunction({ params: { device, function: fn, argument: arg } }){
		const api = new LegacyApiClient();
		api.ensureToken();

		return api.callFunction(device, fn, arg)
			.then(result => {
				if (result && result.hasOwnProperty('return_value')){
					console.log(result.return_value);
				} else {
					throw api.normalizedApiError(result);
				}
			})
			.catch(err => {
				throw new VError(ensureError(err), 'Function call failed');
			});
	}
};

