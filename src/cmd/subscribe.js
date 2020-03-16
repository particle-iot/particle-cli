const os = require('os');
const VError = require('verror');
const settings = require('../../settings');
const spinnerMixin = require('../lib/spinner-mixin');
const { normalizedApiError } = require('../lib/api-client');
const { errors: { usageError } } = require('../app/command-processor');
const ParticleAPI = require('./api');
const UI = require('../lib/ui');


module.exports = class SubscribeCommand {
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

	startListening({ device, all, product, params: { event } }){
		// legacy argument order
		let eventName = event[0];
		let deviceId = event[1] || device;

		// if they typed: "particle subscribe mine"
		if (eventName === 'mine'){
			eventName = null;
		}

		let eventLabel = eventName;
		if (eventLabel){
			eventLabel = '"' + eventLabel + '"';
		} else {
			eventLabel = 'all events';
		}

		if (!deviceId && !all){
			deviceId = 'mine';
		}

		if (product){
			if (!device){
				throw usageError(
					'`device` parameter is required when `--product` flag is set'
				);
			}
		}

		if (!deviceId){
			this.ui.stdout.write(`Subscribing to ${eventLabel} from the firehose (all devices) and my personal stream (my devices)${os.EOL}`);
		} else if (deviceId === 'mine'){
			this.ui.stdout.write(`Subscribing to ${eventLabel} from my personal stream (my devices only)${os.EOL}`);
		} else {
			this.ui.stdout.write(`Subscribing to ${eventLabel} from ${deviceId}'s stream${os.EOL}`);
		}

		const msg = 'Fetching event stream...';
		const fetchStream = createAPI().getEventStream(deviceId, eventName, product);
		const onEvent = (event) => this.ui.stdout.write(`${JSON.stringify(event)}${os.EOL}`);
		return this.showBusySpinnerUntilResolved(msg, fetchStream)
			.then(stream => {
				this.ui.stdout.write(os.EOL);
				return stream;
			})
			.then(stream => stream.on('event', onEvent))
			.catch(error => {
				const message = 'Error fetching event stream';
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

