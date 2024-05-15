module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'publish', 'Publish an event to the cloud', {
		params: '<event> [data]',
		options: {
			'product': {
				description: 'Publish to the given Product ID or Slug\'s stream'
			}
		},
		handler: (args) => {
			const PublishCommand = require('../cmd/publish');
			return new PublishCommand(args).publishEvent(args);
		},
		examples: {
			'$0 $command temp 25.0': 'Publish a temp event to your private event stream',
			'$0 $command temp 25.0 --product 12345': 'Publish a temp event to your product 12345\'s event stream'
		}
	});
};

