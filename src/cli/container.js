module.exports = ({ commandProcessor, root }) => {
	const container = commandProcessor.createCategory(root, 'container', 'Manage containerized applications');

	commandProcessor.createCommand(container, 'run', 'Run a containerized application on the local machine', {
		options: {
			'blueprintDir': {
				description: 'The directory containing the containerized application'
			}
		},
		handler: (args) => {
			const ContainerCommand = require('../cmd/container');
			return new ContainerCommand().run({ ...args.params, blueprintDir: args.blueprintDir });
		},
		examples: {
			'$0 $command my_tachyon': 'Build and push the containerized application in the current directory for the device my_tachyon'
		}
	});

	commandProcessor.createCommand(container, 'push', 'Build and push a containerized application to a device', {
		options: {
			'device': {
				description: 'The device to push to'
			},
			'instance': {
				description: 'The application instance to push'
			},
			'blueprintDir': {
				description: 'The directory containing the containerized application'
			}
		},
		handler: (args) => {
			const ContainerCommand = require('../cmd/container');
			return new ContainerCommand().push({ ...args.params, blueprintDir: args.blueprintDir, deviceId: args.device, instance: args.instance });
		},
		examples: {
			'$0 $command my_tachyon': 'Build and push the containerized application in the current directory for the device my_tachyon'
		}
	});

	commandProcessor.createCommand(container, 'list', 'List containerized applications for a device', {
		options: {
			'device': {
				description: 'The device to list from'
			},
			'blueprintDir': {
				description: 'The directory containing the containerized application'
			}
		},
		handler: (args) => {
			const ContainerCommand = require('../cmd/container');
			return new ContainerCommand().list({ ...args.params, blueprintDir: args.blueprintDir, deviceId: args.device });
		},
		examples: {
			'$0 $command': 'List containerized applications'
		}
	});

	commandProcessor.createCommand(container, 'remove', 'Remove a containerized application from a device', {
		options: {
			'device': {
				description: 'The device to remove from'
			},
			'instance': {
				description: 'The application instance to remove'
			},
			'blueprintDir': {
				description: 'The directory containing the containerized application'
			}
		},
		handler: (args) => {
			const ContainerCommand = require('../cmd/container');
			return new ContainerCommand().remove({ deviceId: args.device, appInstance: args.instance, blueprintDir: args.blueprintDir });
		},
		examples: {
			'$0 $command --instance hello-world_12345': 'Remove this containerized application'
		}
	});

	commandProcessor.createCommand(container, 'configure-docker', 'Configure docker authenticate with the particle container registry', {
		options: {},
		handler: (args) => {
			const ContainerCommand = require('../cmd/container');
			return new ContainerCommand().configureDocker();
		},
		examples: {
			'$0 $command': 'Configure Docker authentication'
		}
	});

	return container;
};
