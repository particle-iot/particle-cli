export default ({ commandProcessor, root }) => {
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
			return new SubscribeCommand(args).startListening();
		}
	});
};
