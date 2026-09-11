'use strict';
const os = require('os');
const CLICommandBase = require('./base');


module.exports = class PublishCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	publishEvent({ product, org, params: { event, data } }){
		// An org event fans out to every product in the org, so naming one
		// product alongside it is contradictory and the API has no such route.
		if (org && product){
			return this.showUsageError(
				'`--org` cannot be combined with `--product`'
			);
		}

		let epilogue = `event: ${event}`;

		if (product){
			epilogue += ` to product: ${product}`;
		} else if (org){
			epilogue += ` to organization: ${org}`;
		}

		const { api } = this._particleApi();
		const publishEvent = api.publishEvent({ name: event, data, product, org });
		return this.ui.showBusySpinnerUntilResolved(`Publishing ${epilogue}`, publishEvent)
			.then(() => this.ui.stdout.write(`Published ${epilogue}${os.EOL}${os.EOL}`));
	}
};

