import cloudCli from '../cli/cloud';

export default (app, cli) => {
	const cloud = cli.createCategory('cloud', 'Commands to interact with the Particle Cloud');

	cloud.command(cli.createCommand('login', 'Login and save an access token for interacting with your account on the Particle Cloud', {
		options: {
			username: {
				alias: 'u',
				string: true,
				description: 'Username',
				required: !global.isInteractive
			},
			password: {
				alias: 'p',
				string: true,
				description: 'Password',
				required: !global.isInteractive
			}
		},
		handler: cloudCli.login
	}));

	cloud.command(cli.createCommand('logout', 'Logout from the Particle Cloud', {
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
	}));

	cloud.command(cli.createCommand('list', 'Displays a list of your devices, along with their variables and functions', {
		params: '[filter]',
		handler(argv) {
			argv.filter = argv.params.filter;
			return cloudCli.listDevices(argv);
		}
	}));

	cloud.command(cli.createCommand('claim', 'Claim a device to your account', {
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
	}));

	cloud.command(cli.createCommand('remove', 'Release a device from your account', {
		params: '<deviceIDOrName>',
		handler(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('name', 'Change the friendly name of a device', {
		params: '<deviceIDOrName> <name>',
		handler(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('flash', 'Flash a binary, source file, or source directory to a device over the air', {
		params: '<deviceIDOrName> <filesOrFolder...>',
		options: {
		},
		handler(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('compile', 'Compiles one or more source files or a directory of source to a firmware binary for your device', {
		params: '<deviceType> <filesOrFolder...>',
		options: {
		},
		handler(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('nyan', 'Commands your device to start/stop shouting rainbows', {
		params: '[deviceIDOrName] [onOff]',
		options: {
		},
		handler(argv) {
			
		}
	}));

	app.command(cloud);
};
