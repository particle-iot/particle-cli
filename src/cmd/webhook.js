'use strict';
const fs = require('fs');
const VError = require('verror');
const inquirer = require('inquirer');
const CLICommandBase = require('./base');
const { requireToken } = require('../lib/api-call');
const { tryParse, getFilenameExt, asyncMapSeries } = require('../lib/utilities');


module.exports = class WebhookCommand extends CLICommandBase {
	createPOSTHook({ eventName, url, device }) {
		return this._createHook({ eventName, url, deviceID: device, requestType: 'POST' });
	}

	createGETHook({ eventName, url, device }) {
		return this._createHook({ eventName, url, deviceID: device, requestType: 'GET' });
	}

	createHook({ eventName, url, device, requestType }) {
		return this._createHook({ eventName, url, deviceID: device, requestType });
	}

	_createHook({ eventName, url, deviceID, requestType }) {
		requireToken();
		const { api } = this._particleApi();

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

		return api.createWebhookWithObj(webhookData);
	}

	async deleteHook({ hookId }) {
		requireToken();
		const { api } = this._particleApi();

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
			const hooks = await api.listWebhooks();
			console.log('Found ' + hooks.length + ' hooks registered\n');
			return asyncMapSeries(hooks, (hook) => {
				console.log('deleting ' + hook.id);
				return api.deleteWebhook({ hookId: hook.id });
			});
		}
		return api.deleteWebhook({ hookId });
	}

	async listHooks() {
		requireToken();
		const { api } = this._particleApi();

		const hooks = await api.listWebhooks();
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
