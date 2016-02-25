import _ from 'lodash';

export default (app, cli) => {
	function alias(category, aliasName, path) {
		let cmd = app;
		path.forEach(p => {
			let tcmd = cmd.commands[p];
			// for commands with positional arguments, do a split then compare
			if (!tcmd) {
				tcmd = _.find(cmd.commands, (c, cmdName) => {
					return cmdName.split(' ')[0] === p;
				});
			}
			cmd = tcmd;
		});
		category.command(cli.createCommand(aliasName, cmd.description, cmd.options));
	}

	alias(app, 'login', ['cloud', 'login']);
	alias(app, 'logout', ['cloud', 'logout']);
	alias(app, 'list', ['cloud', 'list']);
	alias(app, 'nyan', ['cloud', 'nyan']);

	const device = cli.createCategory('device', 'Commands to manipulate a device');
	alias(device, 'add', ['cloud', 'claim']);
	alias(device, 'remove', ['cloud', 'remove']);
	alias(device, 'rename', ['cloud', 'name']);
	app.command(device);

	const core = cli.createCategory('core', false);
	alias(core, 'add', ['cloud', 'claim']);
	alias(core, 'remove', ['cloud', 'remove']);
	alias(core, 'rename', ['cloud', 'name']);
	app.command(core);
};
