import eventCli from '../cli/event';

export default (app, cli) => {
	const event = cli.createCategory(app, 'event', 'Commands to publish and subscribe to the event stream');

	cli.createCommand(event, 'subscribe', 'Subscribe to the event stream', {
		params: '[eventName] [deviceIdOrName]',
		handler(argv) {
			argv.deviceIdOrName = argv.params.deviceIdOrName;
			argv.eventName = argv.params.eventName;
			return eventCli.subscribe(argv);
		}
	});

	cli.createCommand(event, 'publish', 'Publish an event to the event stream', {
		params: '<eventName> [data]',
		options: {
			private: {
				boolean: true,
				default: false,
				description: 'Publish the event to the private data stream for your devices only'
			}
		},
		handler(argv) {
			argv.data = argv.params.data;
			argv.eventName = argv.params.eventName;
			return eventCli.publish(argv);
		}
	});
};
