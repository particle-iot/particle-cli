import when from 'when';
import eventLib from '../lib/event';
import * as ui from './ui';

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

		return eventLib.subscribe(deviceIdOrName, eventName).then(req => {
			return when.promise((resolve, reject) => {
				req.on('event', e => {
					ui.render('eventFeed', e);
				});
				req.on('error', reject);
			});
		});
	}
};

export default event;
