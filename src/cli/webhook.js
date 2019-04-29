const unindent = require('../lib/unindent');

module.exports = ({ commandProcessor, root }) => {
	const webhook = commandProcessor.createCategory(root, 'webhook', 'Manage webhooks that react to device event streams');

	commandProcessor.createCommand(webhook, 'create', 'Creates a postback to the given url when your event is sent', {
		params: '<eventName|filename> [url] [device] [requestType]',
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand().createHook(args.params);
		},
		examples: {
			'$0 $command temp https://xyz.com': 'Make POST requests to xyz.com every time a temp event is received',
			'$0 $command hook.json': 'Create a webhook according to the template in hook.json',
		},
		epilogue: unindent(`
			To customize the hook parameters use a JSON template. See https://docs.particle.io/reference/webhooks/ for details
			{
			  "event": "my-event",
			  "url": "https://my-website.com/fancy_things.php",
			  "deviceid": "optionally filter by providing a device id",
			
			  "_": "The following parameters are optional",
			  "requestType": "GET/POST/PUT/DELETE",
			  "form": null,
			  "json": null,
			  "body": null,
			  "headers": null,
			  "query": null,
			  "auth": null,
			  "responseTemplate": null,
			  "rejectUnauthorized": "true/false"
			}
		`)
	});

	commandProcessor.createCommand(webhook, 'list', 'Show your current Webhooks', {
		handler: () => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand().listHooks();
		}
	});

	commandProcessor.createCommand(webhook, 'delete', 'Deletes a Webhook', {
		params: '<hookId>',
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand().deleteHook(args.params);
		},
		examples: {
			'$0 $command 5a8ef38cb85f8720edce631a': 'Delete webhook with this ID. Find the ID from the list webhook command',
			'$0 $command all': 'Delete all my webhooks',
		}
	});

	commandProcessor.createCommand(webhook, 'POST', 'Create a new POST request hook', {
		params: '<eventName> <url> [device]',
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand().createPOSTHook(args.params);
		}
	});

	commandProcessor.createCommand(webhook, 'GET', 'Create a new GET request hook', {
		params: '<eventName> <url> [device]',
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand().createGETHook(args.params);
		}
	});

	return webhook;
};

