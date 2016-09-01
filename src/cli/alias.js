export default (root, factory, app) => {
	function alias(category, aliasName, path) {
		const cmd = root.find(path);
		if (cmd) {
			factory.createCommand(category, aliasName, cmd.description, cmd.options);
		}
	}

	alias(root, 'login', ['cloud', 'login']);
	alias(root, 'logout', ['cloud', 'logout']);
	alias(root, 'list', ['cloud', 'list']);
	alias(root, 'nyan', ['cloud', 'nyan']);
	alias(root, 'compile', ['cloud', 'compile']);
	alias(root, 'publish', ['event', 'publish']);
	alias(root, 'subscribe', ['event', 'subscribe']);

	const device = factory.createCategory(root, 'device', 'Commands to manipulate a device');
	alias(device, 'add', ['cloud', 'claim']);
	alias(device, 'remove', ['cloud', 'remove']);
	alias(device, 'rename', ['cloud', 'name']);

	const core = factory.createCategory(root, 'core', false);
	alias(core, 'add', ['cloud', 'claim']);
	alias(core, 'remove', ['cloud', 'remove']);
	alias(core, 'rename', ['cloud', 'name']);
};
