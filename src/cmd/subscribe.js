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

	startListening({ device, all, until, max, product, params: { event } }){
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

		if (until){
			this.ui.stdout.write(`This command will exit after receiving event data matching: '${until}'${os.EOL}`);
		}

		if (max){
			max = Math.abs(max);
			this.ui.stdout.write(`This command will exit after receiving ${max} event(s)...${os.EOL}`);
		}

		const msg = 'Fetching event stream...';
		const fetchStream = createAPI().getEventStream(deviceId, eventName, product);
		return this.showBusySpinnerUntilResolved(msg, fetchStream)
			.then(stream => {
				this.ui.stdout.write(os.EOL);
				return stream;
			})
			.then(stream => stream.on('event', this.createEventHandler(until, max)))
			.catch(error => {
				const message = 'Error fetching event stream';
				throw createAPIErrorResult({ error, message });
			});
	}

	createEventHandler(until, max){
		let eventCount = 0;

		return (event) => {
			this.ui.stdout.write(`${JSON.stringify(event)}${os.EOL}`);

			if (until && until === event.data) {
				this.ui.stdout.write('Matching event received. Exiting...');
				process.exit(0);
			}

			if (max){
				eventCount = eventCount + 1;

				if (eventCount === max) {
					this.ui.stdout.write(`${eventCount} event(s) received. Exiting...`);
					process.exit(0);
				}
			}
		};
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

