'use strict';
const CLICommandBase = require('./base');
const ParticleAPI = require('./api');
const settings = require('../../settings');
const fs = require('node:fs/promises');
const { displayEnv, displayRolloutChanges } = require('../lib/env');

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
			displayEnv(data, { sandbox, org, product, device }, this.ui);
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
		const { key, value } = this._parseKeyValue(params);

		const operation = this._buildEnvVarOperation({ key, value, operation: 'Set' });
		await this.ui.showBusySpinnerUntilResolved('Setting environment variable...',
			this.api.patchEnv({
				sandbox,
				org,
				productId: product,
				deviceId: device,
				operations: [operation]
			}));
		this.ui.write(`Key ${key} has been successfully set.`);
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

	async deleteEnv({ params: { key }, org, product, device, sandbox, dryRun }) {
		this._validateScope({ sandbox, org, product, device });

		const data = await this.api.listEnv({ sandbox, org, productId: product, deviceId: device });
		const env = data?.env || {};
		const ownVars = env.own || {};
		const inheritedVars = env.inherited || {};

		const isOwnVar = key in ownVars;
		const isInherited = key in inheritedVars;

		if (!isOwnVar && !isInherited) {
			throw new Error(`Environment variable '${key}' does not exist at this scope.`);
		}
		if (!isOwnVar && isInherited) {
			this.ui.write(this.ui.chalk.yellow(`Warning: '${key}' is inherited from a parent scope and cannot be deleted at this level.`));
			const inheritedFrom = inheritedVars[key]?.from || 'parent scope';
			this.ui.write(this.ui.chalk.yellow(`This variable is defined at: ${inheritedFrom}`));
			this.ui.write(this.ui.chalk.yellow(`To delete it, you must delete it from the scope where it's defined.`));
			return;
		}
		const currentValue = ownVars[key]?.value;

		if (isOwnVar && isInherited) {
			const inheritedValue = inheritedVars[key]?.value;
			this.ui.write(this.ui.chalk.yellow(`Note: '${key}' is an overridden variable. If you delete it, the inherited value '${inheritedValue}' will become visible.`));
		}

		if (dryRun) {
			this.ui.write(this.ui.chalk.cyan(`[DRY RUN] Would delete environment variable '${key}'`));
			this.ui.write(`Current value: ${currentValue}`);
			return;
		}

		const operation = this._buildEnvVarOperation({ key, operation: 'Unset' });
		await this.ui.showBusySpinnerUntilResolved('Deleting environment variable...',
			this.api.patchEnv({
				sandbox,
				org,
				productId: product,
				deviceId: device,
				operations: [operation]
			}));
		this.ui.write(`Key ${key} has been successfully deleted.`);
	}

	async rollout({ org, product, device, sandbox, yes, when }) {
		this._validateScope({ sandbox, org, product, device });

		const target = sandbox ? 'sandbox' : (org || product || device);

		const rolloutPreviewFromSnapShot = await this.ui.showBusySpinnerUntilResolved('Getting environment variable rollout preview...',
			this.api.getRollout({ sandbox, org, productId: product, deviceId: device }));
		const rolloutPreview = rolloutPreviewFromSnapShot.from_snapshot;
		displayRolloutChanges(rolloutPreview, this.ui);

		if (rolloutPreview?.changes?.length > 0) {
			if (!yes) {
				const confirmQuestion = {
					type: 'confirm',
					name: 'confirm',
					message: `Are you sure you want to apply these changes to ${target}?`,
					default: false
				};
				const { confirm } = await this.ui.prompt([confirmQuestion]);
				if (!confirm) {
					this.ui.write('Rollout cancelled.');
					return;
				}
			}
			let rolloutWhen = when || 'Connect';
			if (!yes) {
				const whenQuestion = {
					type: 'list',
					name: 'when',
					message: 'When should the rollout be applied to each device?',
					choices: [
						{ name: 'Immediately', value: 'Immediate' },
						{ name: 'On next connection', value: 'Connect' }
					],
					default: 'Connect',
					dataTesting: 'when-prompt'
				};
				const { when: whenAnswer } = await this.ui.prompt([whenQuestion]);
				rolloutWhen = whenAnswer;
			}
			await this.ui.showBusySpinnerUntilResolved(`Applying changes to ${target}...`,
				this.api.performEnvRollout({ sandbox, org, productId: product, deviceId: device, when: rolloutWhen }));

			this.ui.write(this.ui.chalk.green(`Successfully applied rollout to ${target}.`));
		}
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
