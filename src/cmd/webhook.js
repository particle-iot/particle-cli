const when = require('when');

const prompt = require('inquirer').prompt;
const fs = require('fs');

const ApiClient = require('../lib/ApiClient');
const utilities = require('../lib/utilities');

class WebhookCommand {
	constructor(options) {
		this.options = options;

	}

	createPOSTHook() {
		const eventName = this.options.params.eventName;
		const url = this.options.params.url;
		const deviceID = this.options.params.device;
		return this._createHook({ eventName, url, deviceID, requestType: 'POST' });
	}

	createGETHook() {
		const eventName = this.options.params.eventName;
		const url = this.options.params.url;
		const deviceID = this.options.params.device;
		return this._createHook({ eventName, url, deviceID, requestType: 'GET' });
	}

	createHook() {
		const eventName = this.options.params.eventName;
		const url = this.options.params.url;
		const deviceID = this.options.params.device;
		const requestType = this.options.params.requestType;

		return this._createHook({ eventName, url, deviceID, requestType });
	}


	_createHook({ eventName, url, deviceID, requestType }) {
		const api = new ApiClient();
		if (!api.ready()) {
			return when.reject('Not logged in');
		}

		//if they gave us one thing, and it happens to be a file, and we could parse it as json
		let data = {};
		//particle webhook create xxx.json
		if (eventName && !url && !deviceID) {
			const filename = eventName;

			if (utilities.getFilenameExt(filename).toLowerCase() === '.json') {
				if (!fs.existsSync(filename)) {
					return when.reject(filename + ' is not found.');
				}

				data = utilities.tryParse(fs.readFileSync(filename));
				if (!data) {
					return when.reject('Please check your .json file for syntax error.');
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
			return when.reject('Please specify an event name');
		}

		//required param
		if (!url) {
			return when.reject('Please specify a url');
		}

		//TODO: clean this up more?
		const webhookData = Object.assign({
			event: eventName,
			url: url,
			deviceid: deviceID,
			requestType: requestType || data.requestType,
		}, data);

		return api.createWebhookWithObj(webhookData);
	}

	deleteHook() {
		const hookID = this.options.params.hookId;
		return this._deleteHook(hookID);
	}

	_deleteHook(hookID) {
		const api = new ApiClient();
		if (!api.ready()) {
			return when.reject('Not logged in');
		}

		if (hookID === 'all') {
			// delete all hook using `particle webhook delete all`
			return prompt([{
				type: 'confirm',
				name: 'deleteAll',
				message: 'Do you want to delete ALL your webhooks?',
				default: false
			}]).then((answer) => {
				if (answer.deleteAll) {
					return api.listWebhooks().then(hooks => {
						console.log('Found ' + hooks.length + ' hooks registered\n');
						const deleteHook = (i) => {
							if (i >= hooks.length) {
								return;
							}
							console.log('deleting ' + hooks[i].id);
							return api.deleteWebhook(hooks[i].id).then(() => deleteHook(i + 1));
						};
						return deleteHook(0);
					});
				} else {
					return when.resolve();
				}
			});
		} else {
			// delete a hook based on ID
			return api.deleteWebhook(hookID);
		}
	}

	listHooks() {
		const api = new ApiClient();
		if (!api.ready()) {
			return when.reject('Not logged in');
		}

		return api.listWebhooks().then(hooks => {
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
		});
	}
}

module.exports = WebhookCommand;
