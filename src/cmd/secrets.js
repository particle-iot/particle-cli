
'use strict';
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
		this.consoleBaseUrl = settings.isStaging ? 'https://console.staging.particle.io' : 'https://console.particle.io';
	}

	_validateScope({ sandbox, org }) {
		const scopes = [
			{ name: 'sandbox', value: sandbox },
			{ name: 'org', value: org }
		].filter(scope => scope.value);

		if (scopes.length === 0) {
			throw new Error('You must specify one of: --sandbox or --org');
		}

		if (scopes.length > 1) {
			const scopeNames = scopes.map(s => `--${s.name}`).join(', ');
			throw new Error(`You can only specify one scope at a time. You provided: ${scopeNames}`);
		}
	}

	async list({ org, sandbox, json }) {
		this._validateScope({ sandbox, org });
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

	async get({ params, org, sandbox }){
		this._validateScope({ sandbox, org });
		const name = params.key;
		const secretData = await this.ui.showBusySpinnerUntilResolved(
			'Retrieving secret',
			secrets.get({ api: this.api, name, org })
		);
		this._printSecret({ ...secretData, org });
	}

	async deleteSecret({ params, org, sandbox }) {
		this._validateScope({ sandbox, org });
		const name = params.key;
		const isDeleted = await this.ui.showBusySpinnerUntilResolved(
			'Deleting secret',
			secrets.remove({ api: this.api, org, name })
		);
		if (isDeleted) {
			this.ui.write(`Secret ${name} deleted successfully.`);
		}
	}

	async set({ params, org, sandbox }) {
		this._validateScope({ sandbox, org });
		const { key, value } = this._parseKeyValue(params);
		const secretData = await this.ui.showBusySpinnerUntilResolved(
			'Setting secret',
			secrets.update({ api: this.api, name: key, org, value })
		);
		this.ui.write(`Secret ${key} set successfully.`);
		this._printSecret(secretData);
	}

	_parseKeyValue(params) {
		if (params.key && params.value) {
			return { key: params.key, value: params.value };
		}
		if (params.key && params.key.includes('=')) {
			const [key, ...valueParts] = params.key.split('=');
			const value = valueParts.join('=');

			if (!key || value === undefined) {
				throw new Error('Invalid format. Use either "key value" or "key=value"');
			}

			return { key, value };
		}
		throw new Error('Invalid format. Use either "key value" or "key=value"');
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
