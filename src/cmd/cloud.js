import cloudCli from '../cli/cloud';

export default (app, cli) => {
	const cloud = cli.createCategory(app, 'cloud', 'Commands to interact with the Particle Cloud');

	cli.createCommand(cloud, 'login', 'Login and save an access token for interacting with your account on the Particle Cloud', {
		options: {
			u: {
				alias: 'username',
				string: true,
				description: 'Username',
				required: !global.isInteractive
			},
			p: {
				alias: 'password',
				string: true,
				description: 'Password',
				required: !global.isInteractive
			}
		},
		handler: cloudCli.login
	});

	cli.createCommand(cloud, 'logout', 'Logout from the Particle Cloud', {
		options: {
			revoke: {
				boolean: true,
				description: 'Revoke the current access token'
			},
			p: {
				alias: 'password',
				string: true,
				description: 'Password'
			}
		},
		handler: cloudCli.logout,
		setup(yargs) {
			if (!global.isInteractive && yargs.argv.revoke) {
				yargs.demand('password');
			}
		}
	});

	cli.createCommand(cloud, 'list', 'Displays a list of your devices, along with their variables and functions', {
		params: '[filter]',
		handler(argv) {
			argv.filter = argv.params.filter;
			return cloudCli.listDevices(argv);
		}
	});

	cli.createCommand(cloud, 'claim', 'Claim a device to your account', {
		params: '<deviceId>',
		options: {
			t: {
				alias: 'request-transfer',
				boolean: true,
				description: 'Automatically request transfer if necessary'
			}
		},
		handler(argv) {
			argv.deviceId = argv.params.deviceId;
			return cloudCli.claimDevice(argv);
		}
	});

	cli.createCommand(cloud, 'remove', 'Release a device from your account', {
		params: '<deviceIdOrName>',
		options: {
			f: {
				alias: 'force',
				boolean: true,
				description: 'Remove device without confirmation'
			}
		},
		handler(argv) {
			argv.deviceIdOrName = argv.params.deviceIdOrName;
			return cloudCli.removeDevice(argv);
		}
	});

	cli.createCommand(cloud, 'name', 'Change the friendly name of a device', {
		params: '<deviceIdOrName> <name...>',
		options: {
			f: {
				alias: 'force',
				boolean: true,
				description: 'Rename device without confirmation'
			}
		},
		handler(argv) {
			argv.deviceIdOrName = argv.params.deviceIdOrName;
			argv.name = argv.params.name.join('-');
			return cloudCli.renameDevice(argv);
		}
	});

	cli.createCommand(cloud, 'flash', 'Flash a binary, source file, or source directory to a device over the air', {
		params: '<deviceIdOrName> <filesOrFolder...>',
		options: {
			t: {
				alias: 'target',
				type: 'string',
				description: 'System firmware version you wish to compile against'
			}
		},
		handler(argv) {
			argv.deviceIdOrName = argv.params.deviceIdOrName;
			argv.filesOrFolder = argv.params.filesOrFolder;
			return cloudCli.flashDevice(argv);
		}
	});

	cli.createCommand(cloud, 'compile', 'Compiles one or more source files or a directory of source to a firmware binary for your device', {
		params: '<deviceType> <filesOrFolder...>',
		options: {
			t: {
				alias: 'target',
				type: 'string',
				description: 'System firmware version you wish to compile against'
			},
			saveTo: {
				type: 'string',
				description: 'File path where you want to save the compiled firmware binary'
			}
		},
		handler(argv) {
			argv.deviceType = argv.params.deviceType;
			argv.filesOrFolder = argv.params.filesOrFolder;
			return cloudCli.compileCode(argv);
		}
	});

	cli.createCommand(cloud, 'nyan', 'Commands your device to start/stop shouting rainbows', {
		params: '[deviceIdOrName] [onOff]',
		examples: [
			'$0 cloud nyan my_device_id on',
			'$0 cloud nyan my_device_id off',
			'$0 cloud nyan all on',
			'$0 cloud nyan on',
			'$0 cloud nyan off',
		],
		handler(argv) {
			argv.deviceIdOrName = argv.params.deviceIdOrName;
			argv.onOff = argv.params.onOff;
			return cloudCli.signal(argv);
		}
	});
};
