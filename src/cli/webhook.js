export default ({ commandProcessor, root }) => {
	const webhook = commandProcessor.createCategory(root, 'webhook', 'Webhooks - helpers for reacting to device event streams');

	commandProcessor.createCommand(webhook, 'create', 'Creates a postback to the given url when your event is sent', {
		params: '[eventName] [url] [device] [requestType]',
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand(args).createHook();
		}
	});
/*
    TODO: add example for create with template

	const HookJsonTemplate = {
		'event': 'my-event',
		'url': 'https://my-website.com/fancy_things.php',
		'deviceid': 'optionally filter by providing a device id',

		'_': 'The following parameters are optional',
		'requestType': 'GET/POST/PUT/DELETE',
		'form': null,
		'json': null,
		'body': null,
		'headers': null,
		'query': null,
		'auth': null,
		'responseTemplate': null,
		'rejectUnauthorized': 'true/false'
	};

*/

	commandProcessor.createCommand(webhook, 'list', 'Show your current Webhooks', {
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand(args).listHooks();
		}
	});

	commandProcessor.createCommand(webhook, 'delete', 'Deletes a Webhook', {
		params: '<hookId>',
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand(args).deleteHook();
		}
	});

	commandProcessor.createCommand(webhook, 'POST', 'Create a new POST request hook', {
		params: '<eventName> <url> [device]',
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand(args).createPOSTHook();
		}
	});

	commandProcessor.createCommand(webhook, 'GET', 'Create a new GET request hook', {
		params: '<eventName> <url> [device]',
		handler: (args) => {
			const WebhookCommand = require('../cmd/webhook');
			return new WebhookCommand(args).createGETHook();
		}
	});

	return webhook;
};

