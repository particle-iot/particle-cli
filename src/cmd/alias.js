export default (app, cli) => {
	function alias(category, aliasName, path) {
		const cmd = app.find(path);
		if (cmd) {
			cli.createCommand(category, aliasName, cmd.description, cmd.options);
		}
	}

	alias(app, 'login', ['cloud', 'login']);
	alias(app, 'logout', ['cloud', 'logout']);
	alias(app, 'list', ['cloud', 'list']);
	alias(app, 'nyan', ['cloud', 'nyan']);
	alias(app, 'compile', ['cloud', 'compile']);
	alias(app, 'publish', ['event', 'publish']);
	alias(app, 'subscribe', ['event', 'subscribe']);

	const device = cli.createCategory(app, 'device', 'Commands to manipulate a device');
	alias(device, 'add', ['cloud', 'claim']);
	alias(device, 'remove', ['cloud', 'remove']);
	alias(device, 'rename', ['cloud', 'name']);

	const core = cli.createCategory(app, 'core', false);
	alias(core, 'add', ['cloud', 'claim']);
	alias(core, 'remove', ['cloud', 'remove']);
	alias(core, 'rename', ['cloud', 'name']);
};
