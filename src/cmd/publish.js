const VError = require('verror');
const ApiClient = require('../lib/ApiClient.js');
const ensureError = require('../lib/utilities').ensureError;

class PublishCommand {
	constructor(options) {
		this.options = options;
	}

	publishEvent() {
		const eventName = this.options.params.event;
		const data = this.options.params.data;
		const publicFlag = this.options.public;
		const privateFlag = this.options.private;
		const setPrivate = publicFlag ? false : privateFlag;

		const api = new ApiClient();
		api.ensureToken();

		return api.publishEvent(eventName, data, setPrivate).catch((err) => {
			throw new VError(ensureError(err), 'Could not publish event');
		});
	}
}

module.exports = PublishCommand;
