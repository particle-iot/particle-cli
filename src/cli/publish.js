export default ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'publish', 'Publishes an event to the cloud', {
		params: '<event> [data]',
		options: {
			'private': {
				description: 'Publish to the private stream instead of the public stream'
			}
		},
		handler: (args) => {
			const PublishCommand = require('../cmd/publish');
			return new PublishCommand(args).publishEvent();
		}
	});
};
