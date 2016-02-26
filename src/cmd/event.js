import eventCli from '../cli/event';

export default (app, cli) => {
	const event = cli.createCategory('event', 'Commands to publish and subscribe to the event stream');

	event.command(cli.createCommand('subscribe', 'Subscribe to the event stream', {
		params: '[eventName] [deviceIdOrName]',
		handler(argv) {
			argv.deviceIdOrName = argv.params.deviceIdOrName;
			argv.eventName = argv.params.eventName;
			return eventCli.subscribe(argv);
		}
	}));

	app.command(event);
};
