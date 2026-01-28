'use strict';
const os = require('os');
const CLICommandBase = require('./base');
const ParticleAPI = require('./api');
const settings = require('../../settings');
const fs = require('node:fs/promises');

module.exports = class EnvVarsCommand extends CLICommandBase {
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
		const envVars = await this.ui.showBusySpinnerUntilResolved('Retrieving environment variables...',
			this.api.listEnvVars({ sandbox, org, productId: product, deviceId: device }));
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

	async setEnvVars({ params: { key, value }, org, product, device, sandbox }) {
		this._validateScope({ sandbox, org, product, device });
		const operation = this._buildEnvVarOperation({ key, value, operation: 'Set' });
		await this.ui.showBusySpinnerUntilResolved('Setting environment variable...',
			this.api.patchEnvVars({
				sandbox,
				org,
				productId: product,
				deviceId: device,
				operations: [operation]
			}));
		this.ui.write(`Key ${key} has been successfully set.`);
	}

	async deleteEnv({ params: { key }, org, product, device, sandbox, dryRun }) {
		this._validateScope({ sandbox, org, product, device });

		// Fetch current env vars to check if the key exists and is inherited
		const envVars = await this.api.listEnvVars({ sandbox, org, productId: product, deviceId: device });
		const env = envVars?.env || {};
		const ownVars = env.own || {};
		const inheritedVars = env.inherited || {};

		// Check if the key exists at this level
		const isOwnVar = key in ownVars;
		const isInherited = key in inheritedVars;

		// Variable doesn't exist at all
		if (!isOwnVar && !isInherited) {
			throw new Error(`Environment variable '${key}' does not exist at this scope.`);
		}

		// Variable is only inherited, cannot be deleted at this level
		if (!isOwnVar && isInherited) {
			this.ui.write(this.ui.chalk.yellow(`Warning: '${key}' is inherited from a parent scope and cannot be deleted at this level.`));
			const inheritedFrom = inheritedVars[key]?.from || 'parent scope';
			this.ui.write(this.ui.chalk.yellow(`This variable is defined at: ${inheritedFrom}`));
			this.ui.write(this.ui.chalk.yellow(`To delete it, you must delete it from the scope where it's defined.`));
			return;
		}

		// Variable exists in own scope
		const currentValue = ownVars[key]?.value;

		// Check if this is an override (exists in both own and inherited)
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
			this.api.patchEnvVars({
				sandbox,
				org,
				productId: product,
				deviceId: device,
				operations: [operation]
			}));
		this.ui.write(`Key ${key} has been successfully deleted.`);
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

	_displayRolloutChanges(rolloutData) {
		const { changes, unchanged } = rolloutData;

		this.ui.write(this.ui.chalk.bold('Environment Variable Rollout Details:'));
		this.ui.write('------------------------------------------------');

		if (changes && changes.length > 0) {
			this.ui.write(this.ui.chalk.cyan.bold('Changes to be applied:'));
			changes.forEach(change => {
				if (change.op === 'Added') {
					this.ui.write(`  ${this.ui.chalk.green('+')} ${change.key}: ${change.after}`);
				} else if (change.op === 'Removed') {
					this.ui.write(`  ${this.ui.chalk.red('-')} ${change.key}`);
				} else if (change.op === 'Changed') {
					this.ui.write(`  ${this.ui.chalk.yellow('~')} ${change.key}: ${this.ui.chalk.red(change.before)} -> ${this.ui.chalk.green(change.after)}`);
				}
			});
		} else {
			this.ui.write(this.ui.chalk.gray('No changes to be applied.'));
		}

		if (unchanged && Object.keys(unchanged).length > 0) {
			this.ui.write(this.ui.chalk.bold(`${os.EOL}Unchanged environment variables:`));
			Object.entries(unchanged).forEach(([key, value]) => {
				this.ui.write(`  ${key}: ${value}`);
			});
		}
		this.ui.write('------------------------------------------------');
	}
};

function createAPI() {
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}
