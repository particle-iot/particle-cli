module.exports = ({ commandProcessor, root }) => {
	const app = commandProcessor.createCategory(root, 'app', 'Manage Edge applications');

	commandProcessor.createCommand(app, 'push', 'Build and push an Edge application to a product or device', {
		params: '<deviceId> [appDir]',
		handler: (args) => {
			const appCommand = require('../cmd/app');
			return new appCommand().push(args.params);
		},
		examples: {
			'$0 $command my_tachyon': 'Build and push the Edge application in the current directory for the device my_tachyon'
		}
	});

	commandProcessor.createCommand(app, 'list', 'List Edge applications to a product or device', {
		params: '<deviceId>',
		handler: (args) => {
			const appCommand = require('../cmd/app');
			return new appCommand().list(args.params);
		},
		examples: {
			'$0 $command': 'List Edge applications'
		}
	});

	commandProcessor.createCommand(app, 'remove', 'Remove an Edge application from a product or device', {
		params: '<deviceId> <appName>',
		handler: (args) => {
			const appCommand = require('../cmd/app');
			return new appCommand().remove(args.params);
		},
		examples: {
			'$0 $command': 'Remove this Edge application'
		}
	});

	return app;
};
