'use strict';

var cloudCli = require('../cli/cloud');

module.exports = function cloudCommands(app, cli) {
	var cloud = cli.createCategory('cloud', 'Commands to interact with the Particle Cloud');

	cloud.command(cli.createCommand('login', 'Login and save an access token for interacting with your account on the Particle Cloud', {
		options: {
			u: {
				alias: 'username',
				string: true
			},
			p: {
				alias: 'password',
				string: true
			}
		},
		handler: cloudCli.login
	}));

	cloud.command(cli.createCommand('logout', 'Logout from the Particle Cloud', {
		options: {
			revoke: {
				boolean: true,
				description: 'Revoke the current access token'
			}
		},
		handler: function(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('list', 'Displays a list of your devices, along with their variables and functions', {
		handler: function(argv) {

		}
	}));

	cloud.command(cli.createCommand('claim', 'Claim a device to your account', {
		params: '<deviceID>',
		handler: function(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('remove', 'Release a device from your account', {
		params: '<deviceIDOrName>',
		handler: function(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('name', 'Change the friendly name of a device', {
		params: '<deviceIDOrName> <name>',
		handler: function(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('flash', 'Flash a binary, source file, or source directory to a device over the air', {
		params: '<deviceIDOrName> <filesOrFolder...>',
		options: {
		},
		handler: function(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('compile', 'Compiles one or more source files or a directory of source to a firmware binary for your device', {
		params: '<deviceType> <filesOrFolder...>',
		options: {
		},
		handler: function(argv) {
			
		}
	}));

	cloud.command(cli.createCommand('nyan', 'Commands your device to start/stop shouting rainbows', {
		params: '[deviceIDOrName] [onOff]',
		options: {
		},
		handler: function(argv) {
			
		}
	}));

	app.command(cloud);
};
