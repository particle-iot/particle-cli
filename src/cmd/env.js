'use strict';
const CLICommandBase = require('./base');
const ParticleAPI = require('./api');
const settings = require('../../settings');
const fs = require('node:fs/promises');
const { displayEnv, displayRolloutInstructions } = require('../lib/env');

module.exports = class EnvCommands extends CLICommandBase {
	constructor(...args) {
		super(...args);
		this.api = createAPI();
	}

	_validateScope({ sandbox, org, product, device }) {
		const scopes = [
			{ name: 'sandbox', value: sandbox },
			{ name: 'org', value: org },
			{ name: 'product', value: product },
			{ name: 'device', value: device }
		].filter(scope => scope.value);

		if (scopes.length === 0) {
			throw new Error('You must specify one of: --sandbox, --org, --product, or --device');
		}

		if (scopes.length > 1) {
			const scopeNames = scopes.map(s => `--${s.name}`).join(', ');
			throw new Error(`You can only specify one scope at a time. You provided: ${scopeNames}`);
		}
	}

	async list({ org, product, device, sandbox, json }){
		this._validateScope({ sandbox, org, product, device });
		const data = await this.ui.showBusySpinnerUntilResolved('Retrieving environment variables...',
			this.api.listEnv({ sandbox, org, productId: product, deviceId: device }));
		if (json) {
			this.ui.write(JSON.stringify(data, null, 2));
		} else {
			await displayEnv(data, { sandbox, org, product, device }, this.ui, this.api);
		}
	}


	_writeEnvBlock(key, envEntry, { isOverride = false } = {}) {
		if (!envEntry) {
			return;
		}

		const { value, from = 'Owner' } = envEntry;

		this.ui.write(this.ui.chalk.cyan(this.ui.chalk.bold(key)));
		this.ui.write('---------------------------------------------');
		this.ui.write(`    Value: ${value}${isOverride ? ' (Override)' : ''}`);
		this.ui.write(`    Scope: ${from}`);
		this.ui.write('---------------------------------------------');
	};

	async setEnv({ params, org, product, device, sandbox }) {
		this._validateScope({ sandbox, org, product, device });
		const { name, value } = this._parseKeyValue(params);

		const operation = this._buildEnvVarOperation({ key: name, value, operation: 'Set' });
		await this.ui.showBusySpinnerUntilResolved('Setting environment variable...',
			this.api.patchEnv({
				sandbox,
				org,
				productId: product,
				deviceId: device,
				operations: [operation]
			}));
		this.ui.write(`Environment variable ${name} has been successfully set.`);
		await displayRolloutInstructions({ sandbox, org, product, device }, this.ui, this.api);
	}

	_parseKeyValue(params) {
		if (params.name && params.value) {
			return { name: params.name, value: params.value };
		}
		if (params.name && params.name.includes('=')) {
			const [name, ...valueParts] = params.name.split('=');
			const value = valueParts.join('=');

			if (!name || value === undefined) {
				throw new Error('Invalid format. Use either "name value" or "name=value"');
			}

			return { name, value };
		}
		throw new Error('Invalid format. Use either "name value" or "name=value"');
	}

	async deleteEnv({ params: { name }, org, product, device, sandbox }) {
		this._validateScope({ sandbox, org, product, device });

		const data = await this.api.listEnv({ sandbox, org, productId: product, deviceId: device });
		const env = data?.env || {};
		const ownVars = env.own || {};
		const inheritedVars = env.inherited || {};

		const isOwnVar = name in ownVars;
		const isInherited = name in inheritedVars;

		if (!isOwnVar && !isInherited) {
			throw new Error(`Environment variable '${name}' does not exist at this scope.`);
		}
		if (!isOwnVar && isInherited) {
			this.ui.write(this.ui.chalk.yellow(`Warning: '${name}' is inherited from a parent scope and cannot be deleted at this level.`));
			const inheritedFrom = inheritedVars[name]?.from || 'parent scope';
			this.ui.write(this.ui.chalk.yellow(`This variable is defined at: ${inheritedFrom}`));
			this.ui.write(this.ui.chalk.yellow(`To delete it, you must delete it from the scope where it's defined.`));
			return;
		}

		if (isOwnVar && isInherited) {
			const inheritedValue = inheritedVars[name]?.value;
			this.ui.write(this.ui.chalk.yellow(`Note: '${name}' is an overridden variable. If you delete it, the inherited value '${inheritedValue}' will become visible.`));
		}

		const operation = this._buildEnvVarOperation({ key: name, operation: 'Unset' });
		await this.ui.showBusySpinnerUntilResolved('Deleting environment variable...',
			this.api.patchEnv({
				sandbox,
				org,
				productId: product,
				deviceId: device,
				operations: [operation]
			}));
		this.ui.write(`Environment variable ${name} has been successfully deleted.`);
		await displayRolloutInstructions({ sandbox, org, product, device }, this.ui, this.api);
	}

	async _getOperationsFromFile(filename) {
		try {
			const fileInfo = await fs.readFile(filename, 'utf8');
			const operations = JSON.parse(fileInfo);
			//TODO (hmontero): remove this once api removes access field
			operations.ops?.forEach(operation => {
				operation.access = ['Device'];
			});
			return operations.ops;
		} catch (error) {
			throw new Error(`Unable to process the file ${filename}: ${ error.message }`);
		}
	}

	_buildEnvVarOperation({ key, value, operation }) {
		const validOperations = ['Set', 'Unset'];
		if (!validOperations.includes(operation)) {
			throw Error('Invalid operation for patch ' + operation);
		}
		return {
			op: operation,
			key,
			value
		};
	}
};

function createAPI() {
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}
