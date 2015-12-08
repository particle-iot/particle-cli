'use strict';

module.exports = function keysCommands(app, cli) {
	var keys = cli.createCategory('keys', 'Manage your device\'s keypair and server public key');
	keys.command(cli.createCommand('save', 'Save your keys', {
		params: '<filename>',
		options: {
			'force': {
				boolean: true,
				default: false,
				description: 'Force overwriting of <filename> if it exists'
			}
		},
		handler: function(argv) {
			console.log(argv);
		}
	}));
	app.command(keys);
};
