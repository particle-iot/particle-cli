'use strict';
const { scopeOptions } = require('./integration');

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

	const webhook = commandProcessor.createCategory(root, 'webhook', 'Manage webhooks that react to device event streams', {
		inherited: { options: scopeOptions() }
	});
	alias(webhook, 'create', ['integration', 'create']);
	// `webhook list` is scoped to Webhook-type integrations (the integration list
	// shows every type), so it gets a dedicated handler that pins the filter.
	commandProcessor.createCommand(webhook, 'list', 'Show your current webhooks', {
		handler: (args) => {
			const IntegrationCommand = require('../cmd/integration');
			return new IntegrationCommand().listHooks({ integrationType: 'Webhook', org: args.org, product: args.product });
		}
	});
	// `webhook delete all` is scoped to Webhook-type integrations, mirroring `webhook list`.
	commandProcessor.createCommand(webhook, 'delete', 'Deletes a webhook', {
		params: '<hookId>',
		handler: (args) => {
			const IntegrationCommand = require('../cmd/integration');
			return new IntegrationCommand().deleteHook({ ...args.params, integrationType: 'Webhook', org: args.org, product: args.product });
		},
		examples: {
			'$0 $command 5a8ef38cb85f8720edce631a': 'Delete webhook with this ID. Find the ID from the list command',
			'$0 $command all': 'Delete all my webhooks',
		}
	});
	alias(webhook, 'POST', ['integration', 'POST']);
	alias(webhook, 'GET', ['integration', 'GET']);
};
