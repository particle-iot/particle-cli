module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'publish', 'Publish an event to the cloud', {
		params: '<event> [data]',
		options: {
			'private': {
				boolean: true,
				default: true,
				description: 'Publish to the private stream'
			},
			'public': {
				boolean: true,
				description: 'Publish to the public stream'
			}
		},
		handler: (args) => {
			const PublishCommand = require('../cmd/publish');
			return new PublishCommand().publishEvent(args.params.event, args.params.data, args);
		},
		examples: {
			'$0 $command temperature 25.0': 'Publish a temperature event to your private event stream'
		}
	});
};

