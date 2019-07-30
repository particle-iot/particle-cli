const VError = require('verror');
const ApiClient = require('../lib/api-client');


module.exports = class SubscribeCommand {
	startListening(event, { device, all }) {
		const api = new ApiClient();
		api.ensureToken();

		// legacy argument order
		let eventName = event[0];
		let deviceId = event[1] || device;

		// if they typed: "particle subscribe mine"
		if (eventName === 'mine') {
			eventName = null;
		}

		let eventLabel = eventName;
		if (eventLabel) {
			eventLabel = '"' + eventLabel + '"';
		} else {
			eventLabel = 'all events';
		}

		if (!deviceId && !all) {
			deviceId = 'mine';
		}

		if (!deviceId) {
			console.log('Subscribing to ' + eventLabel + ' from the firehose (all devices) and my personal stream (my devices)');
		} else if (deviceId === 'mine') {
			console.log('Subscribing to ' + eventLabel + ' from my personal stream (my devices only) ');
		} else {
			console.log('Subscribing to ' + eventLabel + ' from ' + deviceId + "'s stream");
		}

		let chunks = [];
		function appendToQueue(arr) {
			for (let i = 0; i < arr.length; i++) {
				const line = (arr[i] || '').trim();
				if (!line) {
					continue;
				}
				chunks.push(line);
				if (line.indexOf('data:') === 0) {
					processItem(chunks);
					chunks = [];
				}
			}
		}

		function processItem(arr) {
			const obj = {};
			for (let i=0;i<arr.length;i++) {
				let line = arr[i];

				if (line.indexOf('event:') === 0) {
					obj.name = line.replace('event:', '').trim();
				} else if (line.indexOf('data:') === 0) {
					line = line.replace('data:', '');
					Object.assign(obj, JSON.parse(line));
				}
			}

			console.log(JSON.stringify(obj));
		}

		return api.getEventStream(eventName, deviceId, (event) => {
			const chunk = event.toString();
			appendToQueue(chunk.split('\n'));
		}).catch(err => {
			throw new VError(api.normalizedApiError(err), 'Error subscribing to event stream');
		});
	}
};

