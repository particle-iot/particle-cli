module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'subscribe', 'Listen to device event stream', {
		params: '[event...]',
		options: {
			'all': {
				boolean: true,
				description: 'Listen to all events instead of just those from my devices'
			},
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
			}
		},
		handler: (args) => {
			const SubscribeCommand = require('../cmd/subscribe');
			return new SubscribeCommand().startListening(args);
		},
		examples: {
			'$0 $command': 'Subscribe to all event published by my devices',
			'$0 $command update': 'Subscribe to events starting with update from my devices',
			'$0 $command --device x': 'Subscribe to all events published by device x',
			'$0 $command --all': 'Subscribe to public events and all events published by my devices',
			'$0 $command --until x': 'Subscribe to all events and exit when an event has data matching x',
			'$0 $command --max x': 'Subscribe to all events and exit after seeing x events'
		}
	});
};

