'use strict';
const fs = require('fs');
const VError = require('verror');
const inquirer = require('inquirer');
const CLICommandBase = require('./base');
const { requireToken } = require('../lib/api-call');
const { tryParse, getFilenameExt, asyncMapSeries } = require('../lib/utilities');


module.exports = class WebhookCommand extends CLICommandBase {
	constructor() {
		super();
		this.api = this._particleApi().api;
	}
	createPOSTHook({ eventName, url, device, org, product, products }) {
		return this._createHook({ eventName, url, deviceID: device, requestType: 'POST', org, product, products });
	}

	createGETHook({ eventName, url, device, org, product, products }) {
		return this._createHook({ eventName, url, deviceID: device, requestType: 'GET', org, product, products });
	}

	createHook({ eventName, url, device, requestType, org, product, products }) {
		return this._createHook({ eventName, url, deviceID: device, requestType, org, product, products });
	}

	async _createHook({ eventName, url, deviceID, requestType, org, product, products }) {
		requireToken();

		// if they gave us one thing, and it happens to be a file, and we could parse it as json
		let data = {};

		// particle webhook create xxx.json
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

		if (!url) {
			throw new VError('Please specify a url');
		}

		const webhookData = Object.assign({
			event: eventName,
			url: url,
			deviceid: deviceID,
			requestType: requestType || data.requestType,
		}, data);

		if (org && !products) {
			throw new VError('Organization webhooks must specify at least one product using --products.');
		}
		if (products && !org) {
			throw new VError('The --products option only applies to organization webhooks. Specify --org, or remove --products.');
		}
		if (products) {
			const productIds = String(products)
				.split(',')
				.map((id) => id.trim())
				.filter(Boolean)
				.map(Number);
			if (productIds.some((id) => Number.isNaN(id))) {
				throw new VError('--products must be a comma-separated list of numeric product IDs.');
			}
			webhookData.product_ids = productIds;
		}

		const response = await this.api.createWebhookWithObj(webhookData, { org, product });
		// The integrations endpoint returns the created integration (no `ok` flag);
		// only treat an explicit error body as a failure.
		if (!response || response.error) {
			throw new VError((response && response.error) || 'Failed to create webhook');
		}
		const id = response.id || (response.integration && response.integration.id);
		console.log(`Successfully created webhook with ID ${id}`);
		return response;
	}

	async deleteHook({ hookId, org, product }) {
		requireToken();

		if (hookId === 'all') {
			const { deleteAll } = await inquirer.prompt([{
				type: 'confirm',
				name: 'deleteAll',
				message: 'Do you want to delete ALL your webhooks?',
				default: false
			}]);
			if (!deleteAll) {
				return;
			}
			const hooks = await this.api.listWebhooks({ org, product });
			console.log('Found ' + hooks.length + ' hooks registered\n');
			return asyncMapSeries(hooks, (hook) => {
				console.log('deleting ' + hook.id);
				return this.api.deleteWebhook({ hookId: hook.id, org, product });
			});
		}
		return this.api.deleteWebhook({ hookId, org, product });
	}

	async listHooks({ org, product } = {}) {
		requireToken();

		const hooks = await this.api.listWebhooks({ org, product });
		console.log('Found ' + hooks.length + ' hooks registered\n');

		for (let i = 0; i < hooks.length; i++) {
			const hook = hooks[i];
			const line = [
				'    ', (i + 1),
				'.) Hook ID ' + hook.id + ' is watching for ',
				'"' + hook.event + '"',

				'\n       ', ' and sending to: ' + hook.url,

				(hook.deviceID) ? '\n       ' + ' for device ' + hook.deviceID : '',

				'\n       ', ' created at ' + hook.created_at,
				'\n'
			].join('');

			console.log(line);
		}
	}
};
