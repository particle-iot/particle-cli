const when = require('when');
const ApiClient = require('../lib/ApiClient.js');

class PublishCommand {
	constructor(options) {
		this.options = options;
	}

	publishEvent() {
		const eventName = this.options.params.event;
		const data = this.options.params.data;
		const setPrivate = this.options.private;

		const api = new ApiClient();
		if (!api.ready()) {
			return -1;
		}

		return api.publishEvent(eventName, data, setPrivate).catch((err) => {
			console.error('Error', err);
			return when.reject(err);
		});
	}
}

module.exports = PublishCommand;
