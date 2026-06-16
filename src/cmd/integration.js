'use strict';
const fs = require('fs');
const VError = require('verror');
const inquirer = require('inquirer');
const CLICommandBase = require('./base');
const { requireToken } = require('../lib/api-call');
const { tryParse, getFilenameExt, asyncMapSeries } = require('../lib/utilities');

// Webhooks are just the most common kind of integration, so unless the caller
// asks for something else every integration created/listed defaults to this type.
const DEFAULT_INTEGRATION_TYPE = 'Webhook';

// The integration types the backend exposes as products. Casing must match the
// `integration_type` discriminator on the backend exactly. Lake/Logic are
// deliberately excluded — they aren't integrations in the product sense.
const INTEGRATION_TYPES = ['Webhook', 'GoogleMaps', 'GoogleCloudPubSub', 'AzureIotHub'];

// Accept `--type googlemaps`, `--type GoogleMaps`, etc. and map back to the
// canonical casing the backend expects.
const INTEGRATION_TYPE_BY_LOWER = INTEGRATION_TYPES.reduce((map, type) => {
	map[type.toLowerCase()] = type;
	return map;
}, {});

function normalizeIntegrationType(type) {
	if (!type) {
		return undefined;
	}
	const canonical = INTEGRATION_TYPE_BY_LOWER[String(type).toLowerCase()];
	if (!canonical) {
		throw new VError(`Invalid integration type "${type}". Valid types are: ${INTEGRATION_TYPES.join(', ')}`);
	}
	return canonical;
}

module.exports = class IntegrationCommand extends CLICommandBase {
	constructor() {
		super();
		this.api = this._particleApi().api;
	}

	createPOSTHook({ eventName, url, device, org, product, integrationType }) {
		return this._createHook({ eventName, url, deviceID: device, requestType: 'POST', org, product, integrationType });
	}

	createGETHook({ eventName, url, device, org, product, integrationType }) {
		return this._createHook({ eventName, url, deviceID: device, requestType: 'GET', org, product, integrationType });
	}

	createHook({ eventName, url, device, requestType, org, product, integrationType }) {
		return this._createHook({ eventName, url, deviceID: device, requestType, org, product, integrationType });
	}

	async _createHook({ eventName, url, deviceID, requestType, org, product, integrationType }) {
		requireToken();

		// if they gave us one thing, and it happens to be a file, and we could parse it as json
		let data = {};

		// particle integration create xxx.json
		if (eventName && !url && !deviceID) {
			const filename = eventName;

			if (getFilenameExt(filename).toLowerCase() === '.json') {
				if (!fs.existsSync(filename)) {
					throw new VError(filename + ' is not found.');
				}

				data = tryParse(fs.readFileSync(filename));

				if (!data) {
					throw new VError('Please check your .json file for syntax error.');
				}

				console.log('Using settings from the file ' + filename);
				// only override these when we didn't get them from the command line
				eventName = data.event || data.eventName;
				url = data.url;
				deviceID = data.deviceid;
			}
		}

		if (!eventName) {
			throw new VError('Please specify an event name');
		}

		// The effective type can come from the --type flag (validated/normalized) or
		// from the JSON file itself; the flag wins when both are present.
		const effectiveType = normalizeIntegrationType(integrationType) || data.integration_type || DEFAULT_INTEGRATION_TYPE;

		// Only webhooks POST to a url; types like GoogleMaps are driven by their
		// own settings (e.g. api_key) and legitimately have no url.
		if (effectiveType === DEFAULT_INTEGRATION_TYPE && !url) {
			throw new VError('Please specify a url');
		}

		const integrationData = Object.assign({
			event: eventName,
			url: url,
			deviceid: deviceID,
			requestType: requestType || data.requestType,
		}, data);

		const response = await this.api.createIntegrationWithObj(integrationData, {
			org,
			product,
			integrationType: effectiveType
		});
		// The integrations endpoint returns the created integration (no `ok` flag);
		// only treat an explicit error body as a failure.
		if (!response || response.error) {
			throw new VError((response && response.error) || 'Failed to create webhook');
		}
		const id = response.id || (response.integration && response.integration.id);
		console.log(`Successfully created webhook with ID ${id}`);
		return response;
	}

	async deleteHook({ hookId, org, product, integrationType }) {
		requireToken();

		// Normalize/validate up front so a bad --type fails fast on either path.
		const type = normalizeIntegrationType(integrationType);

		if (hookId === 'all') {
			const { deleteAll } = await inquirer.prompt([{
				type: 'confirm',
				name: 'deleteAll',
				message: `Do you want to delete ALL your ${type ? type + ' ' : ''}integrations?`,
				default: false
			}]);
			if (!deleteAll) {
				return;
			}
			// No default type: an unscoped "all" means every integration type, not just webhooks.
			const hooks = await this.api.listIntegrations({ org, product, integrationType: type });
			console.log('Found ' + hooks.length + ' integrations registered\n');
			return asyncMapSeries(hooks, (hook) => {
				console.log('deleting ' + hook.id);
				return this.api.deleteIntegration({ integrationId: hook.id, org, product });
			});
		}
		return this.api.deleteIntegration({ integrationId: hookId, org, product });
	}

	async listHooks({ org, product, integrationType } = {}) {
		requireToken();

		// No default type: when the caller doesn't pin one, list every integration
		// type. A given type is normalized/validated so `--type googlemaps` works.
		const type = normalizeIntegrationType(integrationType);
		const hooks = await this.api.listIntegrations({ org, product, integrationType: type });
		console.log('Found ' + hooks.length + ' integrations registered\n');

		for (let i = 0; i < hooks.length; i++) {
			const hook = hooks[i];
			const line = [
				'    ', (i + 1),
				'.) Integration ID ' + hook.id + ' is watching for ',
				'"' + hook.event + '"',

				'\n        type: ' + hook.integration_type,

				// Only webhooks have a url; other types are driven by their own settings.
				hook.url ? '\n        and sending to: ' + hook.url : '',

				(hook.deviceID) ? '\n        for device ' + hook.deviceID : '',

				'\n        created at ' + hook.created_at,
				'\n'
			].join('');

			console.log(line);
		}
	}
};

module.exports.INTEGRATION_TYPES = INTEGRATION_TYPES;
module.exports.DEFAULT_INTEGRATION_TYPE = DEFAULT_INTEGRATION_TYPE;
