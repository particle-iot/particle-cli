'use strict';
const CLICommandBase = require('./base');
const ParticleAPI = require('./api');
const settings = require('../../settings');
const fs = require('node:fs/promises');

module.exports = class EnvVarsCommand extends CLICommandBase {
	constructor(...args) {
		super(...args);
		this.api = createAPI();
	}

	async list({ org, product, device, json }){
		const envVars = await this.ui.showBusySpinnerUntilResolved('Retrieving Environment Variables...',
			this.api.listEnvVars({ org, productId: product, deviceId: device }));
		if (json) {
			this.ui.write(JSON.stringify(envVars, null, 2));
		} else {
			await this._displayEnvVars(envVars);
		}
	}

	async _displayEnvVars(envVars) {
		const env = envVars?.env ?? envVars; //TODO(hmontero): refine this validation
		const noVars =
			envVars.env &&
			(
				(!env.available || Object.keys(env.available).length === 0) &&
				(!env.own || Object.keys(env.own).length === 0) &&
				(!env.inherited || Object.keys(env.inherited).length === 0)
			);

		if (noVars) {
			this.ui.write('No environment variables found.');
			return;
		}
		const envs = envVars?.env;
		const mixedEnvs = {
			...envs.available, // TODO(hmontero): remove it once is removed from api
			...envs.inherited
		};
		const levelDefinedEnvs = envs.own;
		const inheritedEnvKeys = Object.keys(mixedEnvs);
		const levelDefinedEnvKeys = Object.keys(envVars?.env?.own);
		inheritedEnvKeys.forEach((key) => {
			if (levelDefinedEnvs[key]) {
				this._writeEnvBlock(key, levelDefinedEnvs[key], { isOverride: true });
			} else {
				this._writeEnvBlock(key, mixedEnvs[key]);
			}
		});
		levelDefinedEnvKeys
			.filter(key => !inheritedEnvKeys.includes(key))
			.forEach((key) => this._writeEnvBlock(key, levelDefinedEnvs[key]));
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

	async setEnvVars({ params: { key, value }, org, product, device }) {
		const operation = this._buildEnvVarOperation({ key, value, operation: 'set' });
		await this.ui.showBusySpinnerUntilResolved('Setting environment variable...',
			this.api.patchEnvVars({
				org,
				productId: product,
				deviceId: device,
				operations: [operation]
			}));
		this.ui.write(`Key ${key} has been successfully set.`);
	}

	async unsetEnvVars({ params: { key }, org, product, device }) {
		const operation = this._buildEnvVarOperation({ key, operation: 'unset' });
		await this.ui.showBusySpinnerUntilResolved('Unsetting environment variable...',
			this.api.patchEnvVars({
				org,
				productId: product,
				deviceId: device,
				operations: [operation]
			}));
		this.ui.write(`Key ${key} has been successfully unset.`);
	}

	async patchEnvVars({ params: { filename } }, org, product, device) {
		const operations = await this._getOperationsFromFile(filename);
		await this.ui.showBusySpinnerUntilResolved('Patching your environment variables...',
			this.api.patchEnvVars({
				org,
				productId: product,
				deviceId: device,
				operations
			}));
		this.ui.write(`Environment variables has been patched according the file ${filename}`);
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

	async renderEnvVars({ org, product, device, json }){
		const envVars = await this.ui.showBusySpinnerUntilResolved('Retrieving Environment Variables...',
			this.api.renderEnvVars({ org, productId: product, deviceId: device }));
		if (json) {
			this.ui.write(JSON.stringify(envVars, null, 2));
		} else {
			const keys = Object.keys(envVars?.env ?? {});
			if (!keys.length) {
				this.ui.write('No environment variables found.');
				return;
			}
			this._writeRenderBlock(keys, envVars.env);
		}
	}

	_writeRenderBlock(keys, env) {
		this.ui.write(this.ui.chalk.cyan(this.ui.chalk.bold('Environment variables:')));
		this.ui.write('---------------------------------------------');
		keys.forEach((key) => {
			this.ui.write(`    ${key} : ${env[key]}`);
		});
		this.ui.write('---------------------------------------------');
	};

	_buildEnvVarOperation({ key, value, operation }) {
		const validOperations = ['set', 'unset', 'inherit', 'uninherit'];
		if (!validOperations.includes(operation)) {
			throw Error('Invalid operation for patch ' + operation);
		}
		return {
			op: operation,
			key,
			value,
			access: ['Device'] // TODO(hmontero): Remove this once api is fixed
		};
	}
};

function createAPI() {
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}
