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
			}
		},
		handler: (args) => {
			const SubscribeCommand = require('../cmd/subscribe');
			return new SubscribeCommand().startListening(args.params.event, args);
		},
		examples: {
			'$0 $command': 'Subscribe to all event published by my devices',
			'$0 $command update': 'Subscribe to events starting with update from my devices',
			'$0 $command --device x': 'Subscribe to all events published by device x',
			'$0 $command --all': 'Subscribe to public events and all events published by my devices'
		}
	});
};

