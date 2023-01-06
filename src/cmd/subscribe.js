const os = require('os');
const VError = require('verror');
const settings = require('../../settings');
const { normalizedApiError } = require('../lib/api-client');
const CLICommandBase = require('./base');
const ParticleAPI = require('./api');


module.exports = class SubscribeCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	startListening({ device, all, until, max, product, params: { event } }){
		if (all && !event){
			return this.showUsageError(
				'`event` parameter is required when `--all` flag is set'
			);
		}

		if (product && device){
			if (!this.isDeviceId(device)){
				return this.showProductDeviceNameUsageError(device);
			}
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
		return this.ui.showBusySpinnerUntilResolved('Fetching event stream...', fetchStream)
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
			// make sure the event fields are ordered nicely for humans
			const { name, data, published_at: publishedAt, coreid, ttl } = event;
			const { chalk, stdout } = this.ui;
			const coloredEvent = [
				'{ ',
				`"name": ${chalk.red(JSON.stringify(name))}, `,
				`"data": ${chalk.yellow(JSON.stringify(data))}, `,
				`"published_at": ${chalk.green(JSON.stringify(publishedAt))}, `,
				`"coreid": ${chalk.blue(JSON.stringify(coreid))}, `,
				`"ttl": ${ttl}`,
				' }'
			].join('');

			stdout.write(`${coloredEvent}${os.EOL}`);

			if (until && until === event.data) {
				stdout.write('Matching event received. Exiting...');
				process.exit(0);
			}

			if (max){
				eventCount = eventCount + 1;

				if (eventCount === max) {
					stdout.write(`${eventCount} event(s) received. Exiting...`);
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

