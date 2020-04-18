const os = require('os');
const VError = require('verror');
const settings = require('../../settings');
const { normalizedApiError } = require('../lib/api-client');
const ParticleAPI = require('./api');
const CLICommandBase = require('./base');


module.exports = class PublishCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	publishEvent({ private: isPrivate, public: isPublic, product, params: { event, data } }){
		isPrivate = (isPublic && !product) ? false : isPrivate; // `isPrivate: true` by default see: src/cli/publish.js
		const visibility = isPrivate ? 'private' : 'public';
		let epilogue = `${visibility} event: ${event}`;

		if (product){
			epilogue += ` to product: ${product}`;
		}

		const publishEvent = createAPI().publishEvent(event, data, isPrivate, product);
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

