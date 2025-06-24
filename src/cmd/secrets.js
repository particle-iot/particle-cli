
const CLICommandBase = require('./base');
const ParticleAPI = require('./api');
const settings = require('../../settings');
const secrets = require('../lib/secrets');

/**
 * Commands for managing secrets
 * @constructor
 */

module.exports = class SecretsCommand extends CLICommandBase {
	constructor(...args) {
		super(...args);
		this.api = createAPI();
		this.consoleBaseUrl = 'https://console.particle.io';
	}

	async list({ org, json }) {
		const secretsData = await this.ui.showBusySpinnerUntilResolved(
			'Retrieving secrets',
			secrets.list({ org, api: this.api })
		);
		if (!json) {
			secretsData.forEach((secret) => this._printSecret({ ...secret, org }));
		} else {
			this.ui.write(JSON.stringify(secretsData, null, 2));
		}
	}

	async get({ name, org }){
		const secretData = await this.ui.showBusySpinnerUntilResolved(
			'Retrieving secret',
			secrets.get({ api: this.api, name, org })
		);
		this._printSecret({ ...secretData, org });
	}

	async update({ name, value, org }) {
		const secretData = await this.ui.showBusySpinnerUntilResolved(
			'Updating secret',
			secrets.update({ api: this.api, name, value, org })
		);
		this.ui.write(`Secret ${name} updated successfully.`);
		this._printSecret(secretData);
	}

	async remove({ org, name }) {
		const isDeleted = await this.ui.showBusySpinnerUntilResolved(
			'Remove secret',
			secrets.remove({ api: this.api, org, name })
		);
		if (isDeleted) {
			this.ui.write(`Secret ${name} removed successfully.`);
		}
	}

	async create({ name, value, org }) {
		const secretData = await secrets.create({ api: this.api, name, org , value });
		this.ui.write(`Secret ${name} created successfully.`);
		this._printSecret(secretData);
	}

	_printSecret(secret) {
		const secretName = this.ui.chalk.cyan.bold(secret.name);
		this.ui.write(`${secretName}`);
		if (secret.usageCount !== undefined) {
			this.ui.write(`    Usage count: ${secret.usageCount}`);
		}
		if (secret.logicFunctions) {
			if (secret.logicFunctions.length > 0) {
				this.ui.write('    Logic Functions:');
				secret.logicFunctions.forEach(logicFunction => {
					const logicUrl = `${this.consoleBaseUrl}/logic/functions/${logicFunction}/details`;
					this.ui.write(this.ui.chalk.dim(`     - ${logicUrl}`));
				});
			} else {
				this.ui.write(`    Logic Functions: ${this.ui.chalk.dim('(none)')}`);
			}
		}
		if (secret.integrations) {
			if (secret.integrations.length > 0) {
				this.ui.write('    Integrations:');
				secret.integrations.forEach(integration => {
					const orgRoute = secret.org ? `orgs/${secret.org}` : '';
					const productRoute = integration.product_slug ? `${integration.product_slug}` : '';
					let integrationRoute = '';
					if (productRoute) {
						integrationRoute = `${this.consoleBaseUrl}/${productRoute}/integrations/${integration.id}`;
					} else if (orgRoute) {
						integrationRoute = `${this.consoleBaseUrl}/${orgRoute}/integrations/${integration.id}`;
					} else {
						integrationRoute = `${this.consoleBaseUrl}/integrations/${integration.id}`;
					}
					this.ui.write(this.ui.chalk.dim(`     - ${integrationRoute}`));
				});
			} else {
				this.ui.write(`    Integrations: ${this.ui.chalk.dim('(none)')}`);
			}
		}

		this.ui.write(`    Created at: ${secret.createdAt}`);
		this.ui.write(`    Updated at: ${secret.updatedAt}`);
		this.ui.write(`    Last accessed at: ${secret.lastAccessedAt || 'Never accessed' }`);
		this.ui.write('---------------------------------------------');
	}
};



function createAPI() {
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}
