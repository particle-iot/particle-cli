module.exports = ({ commandProcessor, root }) => {
	const app = commandProcessor.createCategory(root, 'app', 'Manage Edge applications');

	commandProcessor.createCommand(app, 'run', 'Run a Edge application on the local machine', {
		params: '[blueprintDir]',
		handler: (args) => {
			const AppCommand = require('../cmd/app');
			return new AppCommand().run(args.params);
		},
		examples: {
			'$0 $command my_tachyon': 'Build and push the Edge application in the current directory for the device my_tachyon'
		}
	});

	commandProcessor.createCommand(app, 'push', 'Build and push an Edge application to a product or device', {
		params: '[blueprintDir]',
		options: {
			'device': {
				description: 'The device to push to'
			},
			'instance': {
				description: 'The application instance to push'
			}
		},
		handler: (args) => {
			const AppCommand = require('../cmd/app');
			return new AppCommand().push({ ...args.params, deviceId: args.device, instance: args.instance });
		},
		examples: {
			'$0 $command my_tachyon': 'Build and push the Edge application in the current directory for the device my_tachyon'
		}
	});

	commandProcessor.createCommand(app, 'list', 'List Edge applications to a product or device', {
		options: {
			'device': {
				description: 'The device to list from'
			}
		},
		handler: (args) => {
			const AppCommand = require('../cmd/app');
			return new AppCommand().list({ ...args.params, deviceId: args.device });
		},
		examples: {
			'$0 $command': 'List Edge applications'
		}
	});

	commandProcessor.createCommand(app, 'remove', 'Remove an Edge application from a product or device', {
		options: {
			'device': {
				description: 'The device to remove from'
			},
			'instance': {
				description: 'The application instance to push'
			}
		},
		handler: (args) => {
			const AppCommand = require('../cmd/app');
			return new AppCommand().remove({ deviceId: args.device, instance: args.instance });
		},
		examples: {
			'$0 $command': 'Remove this Edge application'
		}
	});

	return app;
};
