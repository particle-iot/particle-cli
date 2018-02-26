export default ({ commandProcessor, root }) => {
	const cloud = commandProcessor.createCategory(root, 'cloud', 'Access Particle cloud functionality');

	const compileOptions = {
		'target': {
			description: 'The firmware version to compile against. Defaults to latest version, or version on device for cellular.'
		}
	};

	commandProcessor.createCommand(cloud, 'claim', 'Register a device with your user account with the cloud', {
		params: '<device>',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).claimDevice();
		}
	});

	commandProcessor.createCommand(cloud, 'list', 'Displays a list of your devices, as well as their variables and functions', {
		params: '[filter]',
		/* TODO: document filter
		   online
		   offline
		   platform name (core, photon, electron, etc)
		   device ID
		   device name
		 */
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).listDevices();
		}
	});

	commandProcessor.createCommand(cloud, 'remove', 'Release a device from your account so that another user may claim it', {
		params: '<device>',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).removeDevice();
		}
	});

	commandProcessor.createCommand(cloud, 'name', 'Give a device a name!', {
		params: '<device> <name>',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).nameDevice();
		}
	});

	commandProcessor.createCommand(cloud, 'flash', 'Pass a binary, source file, or source directory to a device!', {
		params: '<device> [files...]',
		options: compileOptions,
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).flashDevice();
		}
	});

	commandProcessor.createCommand(cloud, 'compile', 'Compile a source file, or directory using the cloud compiler', {
		params: '<deviceType> [files...]',
		options: Object.assign({}, compileOptions, {
			'saveTo': {
				description: 'Filename for the compiled binary'
			}
		}),
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).compileCode();
		}
	});

	commandProcessor.createCommand(cloud, 'nyan', 'Make your device shout rainbows', {
		params: '<device> [onOff]',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).nyanMode();
		}
	});

	commandProcessor.createCommand(cloud, 'login', 'Lets you login to the cloud and stores an access token locally', {
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).login();
		}
	});

	commandProcessor.createCommand(cloud, 'logout', 'Logs out your session and clears your saved access token', {
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).logout();
		}
	});

	return cloud;
};
