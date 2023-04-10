const utilities = require('../lib/utilities');

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

	commandProcessor.createCommand(cloud, 'list', 'Display a list of your devices, as well as their variables and functions', {
		params: '[filter]',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).listDevices(args);
		},
		epilogue: `Param filter can be: online, offline, a platform name (${Object.keys(utilities.knownPlatformIds()).join(', ')}), a device ID or name`
	});

	commandProcessor.createCommand(cloud, 'claim', 'Register a device with your user account with the cloud', {
		params: '<deviceID>',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).claimDevice(args);
		},
		examples: {
			'$0 $command 123456789': 'Claim device by id to your account'
		}
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
			return new CloudCommands(args).removeDevice(args);
		},
		examples: {
			'$0 $command 0123456789ABCDEFGHI': 'Remove device by id from your account'
		}
	});

	commandProcessor.createCommand(cloud, 'name', 'Give a device a name!', {
		params: '<device> <name>',
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).renameDevice(args);
		},
		examples: {
			'$0 $command red green': 'Rename device `red` to `green`'
		}
	});

	commandProcessor.createCommand(cloud, 'flash', 'Pass a binary, source file, or source directory to a device!', {
		params: '<device> [files...]',
		options: Object.assign({}, compileOptions, {
			'product': {
				description: 'Target a device within the given Product ID or Slug'
			}
		}),
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).flashDevice(args);
		},
		examples: {
			'$0 $command blue': 'Compile the source code in the current directory in the cloud and flash to device `blue`',
			'$0 $command green tinker': 'Flash the default `tinker` app to device `green`',
			'$0 $command red blink.ino': 'Compile `blink.ino` in the cloud and flash to device `red`',
			'$0 $command orange firmware.bin': 'Flash a pre-compiled `firmware.bin` binary to device `orange`',
			'$0 $command 0123456789abcdef01234567 --product 12345': 'Compile the source code in the current directory in the cloud and flash to device `0123456789abcdef01234567` within product `12345`'
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
			return new CloudCommands(args).compileCode(args);
		},
		examples: {
			'$0 $command photon': 'Compile the source code in the current directory in the cloud for a `photon`',
			'$0 $command electron project --saveTo electron.bin': 'Compile the source code in the project directory in the cloud for an `electron` and save it to a file named `electron.bin`',
		},
		epilogue: `Param deviceType can be: ${Object.keys(utilities.knownPlatformIdsWithAliases()).join(', ')}`
	});

	commandProcessor.createCommand(cloud, 'nyan', 'Make your device shout rainbows', {
		params: '<device> [onOff]',
		options: {
			'product': {
				description: 'Target a device within the given Product ID or Slug'
			}
		},
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).nyanMode(args);
		},
		examples: {
			'$0 $command blue': 'Make the device named `blue` start signaling',
			'$0 $command blue off': 'Make the device named `blue` stop signaling',
			'$0 $command blue --product 12345': 'Make the device named `blue` within product `12345` start signaling'
		}
	});

	commandProcessor.createCommand(cloud, 'login', 'Login to the cloud and store an access token locally', {
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
			sso: {
				description: 'Enterprise sso login',
				boolean: true
			},
			otp: {
				description: 'the login code if two-step authentication is enabled'
			}
		},
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).login(args);
		},
		examples: {
			'$0 $command': 'prompt for credentials and log in',
			'$0 $command --username user@example.com --password test': 'log in with credentials provided on the command line',
			'$0 $command --token <my-api-token>': 'log in with an access token provided on the command line',
			'$0 $command --sso ': 'log in with Enterprise sso'
		}
	});

	commandProcessor.createCommand(cloud, 'logout', 'Log out of your session and clear your saved access token', {
		handler: (args) => {
			const CloudCommands = require('../cmd/cloud');
			return new CloudCommands(args).logout();
		}
	});

	return cloud;
};

