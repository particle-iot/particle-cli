const fs = require('fs');
const VError = require('verror');
const prompt = require('inquirer').prompt;
const ApiClient = require('../lib/api-client');
const { tryParse, getFilenameExt, asyncMapSeries } = require('../lib/utilities');


module.exports = class WebhookCommand {
	constructor(options) {
		this.options = options;
	}

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
		const api = new ApiClient();

		api.ensureToken();

		//if they gave us one thing, and it happens to be a file, and we could parse it as json
		let data = {};

		//particle webhook create xxx.json
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
				//only override these when we didn't get them from the command line
				eventName = data.event || data.eventName;
				url = data.url;
				deviceID = data.deviceid;
			}
		}

		//required param
		if (!eventName) {
			throw new VError('Please specify an event name');
		}

		//required param
		if (!url) {
			throw new VError('Please specify a url');
		}

		const webhookData = Object.assign({
			event: eventName,
			url: url,
			deviceid: deviceID,
			requestType: requestType || data.requestType,
		}, data);

		return api.createWebhookWithObj(webhookData).catch(err => {
			throw new VError(api.normalizedApiError(err), 'Error creating webhook');
		});
	}

	deleteHook({ hookId }) {
		const api = new ApiClient();
		api.ensureToken();

		return Promise.resolve()
			.then(() => {
				if (hookId === 'all') {
					// delete all hook using `particle webhook delete all`
					const question = {
						type: 'confirm',
						name: 'deleteAll',
						message: 'Do you want to delete ALL your webhooks?',
						default: false
					};
					return prompt([question])
						.then((answer) => {
							if (answer.deleteAll) {
								return api.listWebhooks()
									.then(hooks => {
										console.log('Found ' + hooks.length + ' hooks registered\n');
										return asyncMapSeries(hooks, (hook) => {
											console.log('deleting ' + hook.id);
											return api.deleteWebhook(hook.id);
										});
									});
							}
						});
				} else {
					// delete a hook based on ID
					return api.deleteWebhook(hookId);
				}
			})
			.catch(err => {
				throw new VError(api.normalizedApiError(err), 'Error deleting webhook');
			});
	}

	listHooks() {
		const api = new ApiClient();

		api.ensureToken();

		return api.listWebhooks()
			.then(hooks => {
				console.log('Found ' + hooks.length + ' hooks registered\n');

				for (let i=0;i < hooks.length;i++) {
					const hook = hooks[i];
					const line = [
						'    ', (i+1),
						'.) Hook ID ' + hook.id + ' is watching for ',
						'"'+hook.event+'"',

						'\n       ', ' and sending to: ' + hook.url,

						(hook.deviceID) ? '\n       ' + ' for device ' + hook.deviceID : '',

						'\n       ', ' created at ' + hook.created_at,
						'\n'
					].join('');

					console.log(line);
				}
			})
			.catch(err => {
				throw new VError(api.normalizedApiError(err), 'Error listing webhooks');
			});
	}
};

