module.exports = ({ commandProcessor, root }) => {
	const app = commandProcessor.createCategory(root, 'app', 'Manage Edge applications');

	commandProcessor.createCommand(app, 'run', 'Run a Edge application on the local machine', {
		options: {
			'blueprintDir': {
				description: 'The directory containing the Edge application'
			}
		},
		handler: (args) => {
			const AppCommand = require('../cmd/app');
			return new AppCommand().run({ ...args.params, blueprintDir: args.blueprintDir });
		},
		examples: {
			'$0 $command my_tachyon': 'Build and push the Edge application in the current directory for the device my_tachyon'
		}
	});

	commandProcessor.createCommand(app, 'push', 'Build and push an Edge application to a product or device', {
		options: {
			'device': {
				description: 'The device to push to'
			},
			'instance': {
				description: 'The application instance to push'
			},
			'blueprintDir': {
				description: 'The directory containing the Edge application'
			}
		},
		handler: (args) => {
			const AppCommand = require('../cmd/app');
			return new AppCommand().push({ ...args.params, blueprintDir: args.blueprintDir, deviceId: args.device, instance: args.instance });
		},
		examples: {
			'$0 $command my_tachyon': 'Build and push the Edge application in the current directory for the device my_tachyon'
		}
	});

	commandProcessor.createCommand(app, 'list', 'List Edge applications to a product or device', {
		options: {
			'device': {
				description: 'The device to list from'
			},
			'blueprintDir': {
				description: 'The directory containing the Edge application'
			}
		},
		handler: (args) => {
			const AppCommand = require('../cmd/app');
			return new AppCommand().list({ ...args.params, blueprintDir: args.blueprintDir, deviceId: args.device });
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
				description: 'The application instance to remove'
			},
			'blueprintDir': {
				description: 'The directory containing the Edge application'
			}
		},
		handler: (args) => {
			const AppCommand = require('../cmd/app');
			return new AppCommand().remove({ deviceId: args.device, appInstance: args.instance, blueprintDir: args.blueprintDir });
		},
		examples: {
			'$0 $command --instance hello-world_12345': 'Remove this Edge application'
		}
	});

	return app;
};
