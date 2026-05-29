'use strict';
const os = require('os');
const CLICommandBase = require('./base');


module.exports = class PublishCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	publishEvent({ product, params: { event, data } }){
		let epilogue = `private event: ${event}`;

		if (product){
			epilogue += ` to product: ${product}`;
		}

		const { api } = this._particleApi();
		const publishEvent = api.publishEvent({ name: event, data, product });
		return this.ui.showBusySpinnerUntilResolved(`Publishing ${epilogue}`, publishEvent)
			.then(() => this.ui.stdout.write(`Published ${epilogue}${os.EOL}${os.EOL}`));
	}
};
