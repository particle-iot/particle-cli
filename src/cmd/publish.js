const os = require('os');
const VError = require('verror');
const settings = require('../../settings');
const spinnerMixin = require('../lib/spinner-mixin');
const { normalizedApiError } = require('../lib/api-client');
const ParticleAPI = require('./api');
const UI = require('../lib/ui');


module.exports = class PublishCommand {
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

	publishEvent({ private: isPrivate, public: isPublic, params: { event, data } }){
		const setPrivate = isPublic ? false : isPrivate;
		const visibility = setPrivate ? 'private' : 'public';
		const epilogue = `${visibility} event: ${event}`;
		const publishEvent = createAPI().publishEvent(event, data, setPrivate);
		return this.showBusySpinnerUntilResolved(`Publishing ${epilogue}`, publishEvent)
			.then(() => this.ui.stdout.write(`Published ${epilogue}${os.EOL}${os.EOL}`))
			.catch(error => {
				const message = 'Error publishing event';
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

