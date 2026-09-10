'use strict';

module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'subscribe', 'Listen to device event stream', {
		params: '[event]',
		options: {
			'device': {
				describe: 'Listen to events from this device only'
			},
			'until': {
				describe: 'Listen until we see an event exactly matching this data'
			},
			'max': {
				number: true,
				describe: 'Listen until we see this many events'
			},
			'product': {
				description: 'Target a device within the given Product ID or Slug'
			},
			'org': {
				description: 'Specify the organization slug (e.g. my-org)'
			}
		},
		handler: (args) => {
			const SubscribeCommand = require('../cmd/subscribe');
			return new SubscribeCommand(args).startListening(args);
		},
		examples: {
			'$0 $command': 'Subscribe to all event published by my devices',
			'$0 $command update': 'Subscribe to events starting with `update` from my devices',
			'$0 $command --product 12345': 'Subscribe to all events published by devices within product `12345`',
			'$0 $command --org my-org': 'Subscribe to all events published by devices within organization `my-org`',
			'$0 $command --device blue': 'Subscribe to all events published by device `blue`',
			'$0 $command --until data': 'Subscribe to all events and exit when an event has data matching `data`',
			'$0 $command --max 4': 'Subscribe to all events and exit after seeing `4` events'
		}
	});
};

