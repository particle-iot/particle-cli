
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
	}

	async list({ org, json }) {
		const secretsData = await secrets.list({ org, api: this.api });
		if (!json) {
			secretsData.forEach((secret) => this._printSecret(secret));
		} else {
			this.ui.write(JSON.stringify(secretsData, null, 2));
		}
	}

	async get({ name, org }){
		const secretData = await secrets.get({ api: this.api, name, org });
		this._printSecret(secretData);
	}

	async update({ name, value, org }) {
		const secretData = await secrets.update({ api: this.api, name, value, org });
		this.ui.write(`Secret ${name} updated successfully.`);
		this._printSecret(secretData);
	}

	async remove({ org, name }) {
		const isDeleted = await secrets.remove({ api: this.api, org, name });
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
		if (secret.integrationsCount !== undefined) {
			this.ui.write(`    Integrations usage count: ${secret.integrationsCount}`);
		}
		if (secret.logicFunctionsCount !== undefined) {
			this.ui.write(`    Logic Functions usage count: ${secret.logicFunctionsCount}`);
		}

		if (secret.logicFunctions) {
			this.ui.write('    Logic Functions:');
			secret.logicFunctions.forEach(logicFunction => {
				this.ui.write(`		${logicFunction}`);
			});
		}
		if (secret.integrations) {
			this.ui.write('    Integrations:');
			secret.integrations.forEach(integration => {
				this.ui.write(this.ui.chalk.dim(`     - ${integration.name}`));
			});
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
