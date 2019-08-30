module.exports = ({ commandProcessor, root }) => {
	const cloud = commandProcessor.createCategory(root, 'cloud', 'Access Particle cloud functionality');

	const compileOptions = {
		'target': {
			description: 'The firmware version to compile against. Defaults to latest version, or version on device for cellular.'
		},
		'followSymlinks': {
			boolean: true,
			description: 'Follow symlinks when collecting files'
		}
	};

	commandProcessor.createCommand(cloud, 'claim', 'Register a device with your user account with the cloud', {
		params: '<device>',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands().claimDevice(args.params.device);
		},
		examples: {
			'$0 $command 123456789': 'Claim device by id to your account'
		}
	});

	commandProcessor.createCommand(cloud, 'list', 'Display a list of your devices, as well as their variables and functions', {
		params: '[filter]',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands().listDevices(args.params.filter);
		},
		epilogue: 'Param filter can be: online, offline, a platform name (photon, electron, etc), a device ID or name'
	});

	commandProcessor.createCommand(cloud, 'remove', 'Release a device from your account so that another user may claim it', {
		params: '<device>',
		options: {
			'yes': {
				boolean: true,
				description: 'Answer yes to all questions'
			}
		},
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands().removeDevice(args.params.device, args);
		},
		examples: {
			'$0 $command 0123456789ABCDEFGHI': 'Remove device by id from your account'
		}
	});

	commandProcessor.createCommand(cloud, 'name', 'Give a device a name!', {
		params: '<device> <name>',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands().renameDevice(args.params.device, args.params.name);
		},
		examples: {
			'$0 $command red green': 'Rename red device to green'
		}
	});

	commandProcessor.createCommand(cloud, 'flash', 'Pass a binary, source file, or source directory to a device!', {
		params: '<device> [files...]',
		options: Object.assign({}, compileOptions, {
			'yes': {
				boolean: true,
				description: 'Answer yes to all questions'
			}
		}),
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands().flashDevice(args.params.device, args.params.files, args);
		},
		examples: {
			'$0 $command blue': 'Compile the source code in the current directory in the cloud and flash to device blue',
			'$0 $command green tinker': 'Flash the default Tinker app to device green',
			'$0 $command red blink.ino': 'Compile blink.ino in the cloud and flash to device red',
			'$0 $command orange firmware.bin': 'Flash the pre-compiled binary to device orange',
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
			return new CloudCommands().compileCode(args.params.deviceType, args.params.files, args);
		},
		examples: {
			'$0 $command photon': 'Compile the source code in the current directory in the cloud for a Photon',
			'$0 $command electron project --saveTo electron.bin': 'Compile the source code in the project directory in the cloud for a Electron and save it to electron.bin',
		},
		// TODO: get the platforms from config and document in epilogue
		epilogue: 'Param deviceType can be: core, photon, p1, electron, argon, asom, boron, bsom, xenon, xsom, etc'
	});

	commandProcessor.createCommand(cloud, 'nyan', 'Make your device shout rainbows', {
		params: '<device> [onOff]',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands().nyanMode(args.params.device, args.params.onOff);
		}
	});

	commandProcessor.createCommand(cloud, 'login', 'Login to the cloud and store an access token locally', {
		examples: {
			'$0 $command': 'prompt for credentials and log in',
			'$0 $command --username user@example.com --password test': 'log in with credentials provided on the command line',
			'$0 $command --token <my-api-token>': 'log in with an access token provided on the command line'
		},
		options: {
			u: {
				description: 'your username',
				alias: 'username'
			},
			p: {
				description: 'your password',
				alias: 'password'
			},
			t: {
				description: 'an existing Particle access token to use',
				alias: 'token'
			},
			otp: {
				description: 'the login code if two-step authentication is enabled'
			}
		},
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands().login(args);
		}
	});

	commandProcessor.createCommand(cloud, 'logout', 'Log out of your session and clear your saved access token', {
		handler: () => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands().logout();
		}
	});

	return cloud;
};

