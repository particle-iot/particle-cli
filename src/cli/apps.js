module.exports = ({ commandProcessor, root }) => {
	const apps = commandProcessor.createCategory(root, 'apps', 'Manage Edge applications');

	commandProcessor.createCommand(apps, 'push', 'Build and push an Edge application to a product or device', {
		handler: () => {
			const AppsCommand = require('../cmd/apps');
			return new AppsCommand().push();
		},
		examples: {
			'$0 $command': 'Build and push this Edge application'
		}
	});

	commandProcessor.createCommand(apps, 'list', 'List Edge applications to a product or device', {
		handler: () => {
			const AppsCommand = require('../cmd/apps');
			return new AppsCommand().list();
		},
		examples: {
			'$0 $command': 'List Edge applications'
		}
	});

	commandProcessor.createCommand(apps, 'remove', 'Remove an Edge application from a product or device', {
		handler: () => {
			const AppsCommand = require('../cmd/apps');
			return new AppsCommand().remove();
		},
		examples: {
			'$0 $command': 'Remove this Edge application'
		}
	});

	return apps;
};
