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
		if (all && !event){
			throw usageError(
				'`event` parameter is required when `--all` flag is set'
			);
		}

		const msg = ['Subscribing to'];

		if (!device && !product && !all){
			device = 'mine';
		}

		if (event){
			msg.push(`"${event}"`);
		} else if (all){
			msg.push('public events');
		} else {
			msg.push('all events');
		}

		if (all){
			msg.push('from the firehose (all devices) and my personal stream (my devices)');
		} else if (device && product){
			msg.push(`from product ${product} device ${device}'s stream`);
		} else if (product){
			msg.push(`from product ${product}'s stream`);
		} else if (device){
			const source = device === 'mine' ? 'my devices' : `device ${device}'s stream`;
			msg.push(`from ${source}`);
		} else {
			msg.push('from my personal stream (my devices)');
		}

		this.ui.stdout.write(msg.join(' ') + os.EOL);

		if (until){
			this.ui.stdout.write(`This command will exit after receiving event data matching: '${until}'${os.EOL}`);
		}

		if (max){
			max = Math.abs(max);
			this.ui.stdout.write(`This command will exit after receiving ${max} event(s)...${os.EOL}`);
		}

		const fetchStream = createAPI().getEventStream(device, event, product);
		return this.showBusySpinnerUntilResolved('Fetching event stream...', fetchStream)
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

