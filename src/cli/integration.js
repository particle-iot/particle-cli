'use strict';
const unindent = require('../lib/unindent');
const { INTEGRATION_TYPES, DEFAULT_INTEGRATION_TYPE } = require('../cmd/integration');

// `--org` / `--product` scope every integration subcommand. Exposed as a factory
// so the `webhook` alias category can inherit the same options without sharing
// (and mutating) a single object.
const scopeOptions = () => ({
	'org': {
		description: 'Specify the organization slug (e.g. my-org)'
	},
	'product': {
		description: 'Specify the product id or slug'
	}
});

module.exports = ({ commandProcessor, root }) => {
	const integration = commandProcessor.createCategory(root, 'integration', 'Manage integrations that react to device event streams', {
		inherited: { options: scopeOptions() }
	});

	commandProcessor.createCommand(integration, 'create', 'Creates an integration triggered when your event is sent', {
		params: '<eventName|filename> [url] [device] [requestType]',
		options: {
			'type': {
				description: `The integration type to create (default ${DEFAULT_INTEGRATION_TYPE}). One of: ${INTEGRATION_TYPES.join(', ')}`
			}
		},
		handler: (args) => {
			const IntegrationCommand = require('../cmd/integration');
			return new IntegrationCommand().createHook({ ...args.params, integrationType: args.type, org: args.org, product: args.product });
		},
		examples: {
			'$0 $command temp https://xyz.com': 'Make POST requests to xyz.com every time a temp event is received',
			'$0 $command hook.json': 'Create an integration according to the template in hook.json',
			'$0 $command gmaps.json --type GoogleMaps': 'Create a Google Maps integration from gmaps.json',
		},
		epilogue: unindent(`
			To customize the integration parameters use a JSON template. See https://docs.particle.io/reference/webhooks/ for details
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

	commandProcessor.createCommand(integration, 'list', 'Show your current integrations', {
		handler: (args) => {
			const IntegrationCommand = require('../cmd/integration');
			return new IntegrationCommand().listHooks({ org: args.org, product: args.product });
		}
	});

	commandProcessor.createCommand(integration, 'delete', 'Deletes an integration', {
		params: '<hookId>',
		handler: (args) => {
			const IntegrationCommand = require('../cmd/integration');
			return new IntegrationCommand().deleteHook({ ...args.params, org: args.org, product: args.product });
		},
		examples: {
			'$0 $command 5a8ef38cb85f8720edce631a': 'Delete integration with this ID. Find the ID from the list command',
			'$0 $command all': 'Delete all my integrations',
		}
	});

	commandProcessor.createCommand(integration, 'POST', 'Create a new POST request hook', {
		params: '<eventName> <url> [device]',
		handler: (args) => {
			const IntegrationCommand = require('../cmd/integration');
			return new IntegrationCommand().createPOSTHook({ ...args.params, org: args.org, product: args.product });
		}
	});

	commandProcessor.createCommand(integration, 'GET', 'Create a new GET request hook', {
		params: '<eventName> <url> [device]',
		handler: (args) => {
			const IntegrationCommand = require('../cmd/integration');
			return new IntegrationCommand().createGETHook({ ...args.params, org: args.org, product: args.product });
		}
	});

	return integration;
};

module.exports.scopeOptions = scopeOptions;
