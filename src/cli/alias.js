'use strict';
module.exports = ({ commandProcessor, root }) => {
	function alias(category, aliasName, path) {
		const cmd = root.find(path);
		if (cmd) {
			// Re-resolve inherited auth options on the target before copying, since the
			// alias is reparented to a new node and would otherwise lose values the
			// target inherited from its original category.
			const tokenExpiryThresholdMs = cmd._resolveTokenExpiryThresholdMs();
			const relogin = cmd._resolveRelogin();
			const options = { ...cmd.options, tokenExpiryThresholdMs, relogin };
			commandProcessor.createCommand(category, aliasName, cmd.description, options);
		}
	}

	alias(root, 'login', ['cloud', 'login']);
	alias(root, 'logout', ['cloud', 'logout']);
	alias(root, 'list', ['cloud', 'list']);
	alias(root, 'nyan', ['cloud', 'nyan']);
	alias(root, 'call', ['function', 'call']);
	alias(root, 'get', ['variable', 'get']);
	alias(root, 'monitor', ['variable', 'monitor']);

	alias(root, 'compile', ['cloud', 'compile']);

	alias(root, 'identify', ['serial', 'identify']);

	const device = commandProcessor.createCategory(root, 'device', 'Manipulate a device');
	alias(device, 'add', ['cloud', 'claim']);
	alias(device, 'remove', ['cloud', 'remove']);
	alias(device, 'rename', ['cloud', 'name']);
	alias(device, 'doctor', ['doctor']);
};
