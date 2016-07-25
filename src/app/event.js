import when from 'when';
import eventLib from '../cmd/event';
import * as ui from './ui';
import log from './log';

const event = {
	subscribe(opts) {
		let eventName = opts.eventName;
		let deviceIdOrName = opts.deviceIdOrName;

		if (!deviceIdOrName && eventName === 'mine') {
			deviceIdOrName = 'mine';
			eventName = undefined;
		} else if (eventName === 'mine' && deviceIdOrName) {
			eventName = undefined;
		}

		const eventLabel = eventName ? `"${eventName}"` : 'all events';
		if (!deviceIdOrName) {
			log.success(`Subscribing to ${eventLabel} from the firehose (all devices)`);
		} else if (deviceIdOrName === 'mine') {
			log.success(`Subscribing to ${eventLabel} from your personal stream (your devices only)`);
		} else {
			log.success(`Subscribing to ${eventLabel} from ${deviceIdOrName}'s stream`);
		}

		return eventLib.subscribe(deviceIdOrName, eventName).then(req => {
			return when.promise((resolve, reject) => {
				req.on('event', e => {
					ui.render('eventFeed', e);
				});
				req.on('error', reject);
			});
		}).catch(err => {
			const errors = err && err.body && err.body.info;
			return when.reject(errors || err);
		});
	},

	publish(opts) {
		return eventLib.publish(opts.eventName, opts.data, opts.private).then(() => {
			log.success(`Successfully published event ${opts.eventName}`);
		});
	}
};

export default event;
