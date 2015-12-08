'use strict';

module.exports = function aliasCommands(app, cli) {
	app.command(cli.createCommand('login',
		app.commands.cloud.commands.login.description, app.commands.cloud.commands.login.options));
	app.command(cli.createCommand('logout',
		app.commands.cloud.commands.logout.description, app.commands.cloud.commands.logout.options));
	app.command(cli.createCommand('list',
		app.commands.cloud.commands.list.description, app.commands.cloud.commands.list.options));
	app.command(cli.createCommand('nyan',
		app.commands.cloud.commands.nyan.description, app.commands.cloud.commands.nyan.options));

	var device = cli.createCategory('device', 'Commands to manipulate a device');
	device.command(cli.createCommand('add',
		app.commands.cloud.commands.claim.description, app.commands.cloud.commands.claim.options));
	device.command(cli.createCommand('remove',
		app.commands.cloud.commands.remove.description, app.commands.cloud.commands.remove.options));
	device.command(cli.createCommand('rename',
		app.commands.cloud.commands.name.description, app.commands.cloud.commands.name.options));
	app.command(device);

	var core = cli.createCategory('core', false);
	core.command(cli.createCommand('add',
		app.commands.cloud.commands.claim.description, app.commands.cloud.commands.claim.options));
	core.command(cli.createCommand('remove',
		app.commands.cloud.commands.remove.description, app.commands.cloud.commands.remove.options));
	core.command(cli.createCommand('rename',
		app.commands.cloud.commands.name.description, app.commands.cloud.commands.name.options));
	app.command(core);
};
