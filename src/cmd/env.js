'use strict';
const os = require('os');
const CLICommandBase = require('./base');
const ParticleAPI = require('./api');
const settings = require('../../settings');
const fs = require('node:fs/promises');
const Table = require('cli-table');

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
			await this._displayEnv(data, { sandbox, org, product, device });
		}
	}

	async _displayEnv(data, scope = {}) {
		const lastSnapshotRendered = data?.last_snapshot?.rendered || {};
		const envInherited = data?.env?.inherited || {};
		const envOwn = data?.env?.own || {};
		const onDeviceData = data?.on_device || null;

		// Check if there are any variables at all
		const hasLastSnapshot = Object.keys(lastSnapshotRendered).length > 0;
		const hasInherited = Object.keys(envInherited).length > 0;
		const hasOwn = Object.keys(envOwn).length > 0;

		if (!hasLastSnapshot && !hasInherited && !hasOwn) {
			this.ui.write('No environment variables found.');
			return;
		}

		// Check for pending changes
		// A change is pending if:
		// 1. A variable is in env.own but NOT in last_snapshot.rendered (new variable)
		// 2. A variable is in both but with different values (updated variable)
		let hasPendingChanges = false;
		for (const key in envOwn) {
			if (!(key in lastSnapshotRendered) || lastSnapshotRendered[key] !== envOwn[key].value) {
				hasPendingChanges = true;
				break;
			}
		}

		// Determine if we should show the "On Device" column (only for --device)
		const showOnDevice = !!scope.device;

		// Calculate column widths
		const nameWidth = 25;
		const valueWidth = 30;
		const onDeviceWidth = 15;
		const scopeWidth = 20;
		const overriddenWidth = 12;

		// Create table with headers based on whether we show "On Device"
		const headers = ['Name', 'Value'];
		const colWidths = [nameWidth, valueWidth];

		if (showOnDevice) {
			headers.push('On Device');
			colWidths.push(onDeviceWidth);
		}

		headers.push('Scope', 'Overridden');
		colWidths.push(scopeWidth, overriddenWidth);

		const table = new Table({
			head: headers,
			colWidths: colWidths,
			style: { head: ['cyan', 'bold'] },
			wordWrap: true
		});

		// Collect all unique keys - ONLY from last_snapshot.rendered and env.inherited
		// Do NOT include keys from env.own that aren't in rendered, as those are pending changes
		const allKeys = new Set([
			...Object.keys(lastSnapshotRendered),
			...Object.keys(envInherited)
		]);

		// Sort keys alphabetically for consistent display
		const sortedKeys = Array.from(allKeys).sort();

		// Process each environment variable
		sortedKeys.forEach((key) => {
			const snapshotValue = lastSnapshotRendered[key];
			const inheritedEntry = envInherited[key];
			const ownEntry = envOwn[key];

			const isInOwn = !!ownEntry;
			const isInherited = !!inheritedEntry;

			// Determine the current value - use snapshot value (what's actually on devices)
			// not the pending value from env.own
			let value;
			if (snapshotValue !== undefined) {
				value = snapshotValue;
			} else if (ownEntry) {
				// If not in snapshot yet but in own, use own value
				value = ownEntry.value;
			} else if (inheritedEntry) {
				value = inheritedEntry.value;
			}

			// Get on device value from on_device field if available
			let onDeviceValue = 'missing';
			if (showOnDevice) {
				if (onDeviceData && onDeviceData[key] !== undefined) {
					onDeviceValue = onDeviceData[key];
				}
			}

			let envScope;
			let isOverridden = false;

			// Determine scope based on parameters
			if (scope.sandbox || scope.org) {
				// For sandbox or org, all scopes are "Organization"
				envScope = 'Organization';
			} else if (scope.product) {
				// For product: use the 'from' field from inherited if in own is false
				// otherwise it's "Product"
				if (isInOwn) {
					envScope = 'Product';
					// It's overridden only if the change is already applied (in snapshot) AND there's an inherited value
					// If it's only in env.own but not in snapshot yet, it's pending and not overriding yet
					const isApplied = snapshotValue !== undefined && snapshotValue === ownEntry.value;
					isOverridden = isApplied && isInherited;
				} else if (inheritedEntry) {
					// Use the 'from' field to determine scope
					envScope = inheritedEntry.from === 'Product' ? 'Product' : 'Organization';
				}
			} else if (scope.device) {
				// For device: if in own, it's "Device", otherwise use 'from' field
				if (isInOwn) {
					envScope = 'Device';
					// It's overridden only if the change is already applied (in snapshot or on_device) AND there's an inherited value
					const isApplied = (snapshotValue !== undefined && snapshotValue === ownEntry.value) ||
						(onDeviceData && onDeviceData[key] !== undefined && onDeviceData[key] === ownEntry.value);
					isOverridden = isApplied && isInherited;
				} else if (inheritedEntry) {
					// Use the 'from' field to determine scope
					const fromField = inheritedEntry.from || '';
					if (fromField === 'Device') {
						envScope = 'Device';
					} else if (fromField === 'Product') {
						envScope = 'Product';
					} else {
						envScope = 'Organization';
					}
				}
			}

			// Truncate long values
			const displayValue = value && value.length > valueWidth - 3
				? value.substring(0, valueWidth - 6) + '...'
				: value;

			const displayOnDeviceValue = onDeviceValue && onDeviceValue.length > onDeviceWidth - 3
				? onDeviceValue.substring(0, onDeviceWidth - 6) + '...'
				: onDeviceValue;

			// Build the row based on whether we show "On Device"
			const row = [key, displayValue || ''];

			if (showOnDevice) {
				row.push(displayOnDeviceValue);
			}

			row.push(envScope || '', isOverridden ? 'Yes' : 'No');

			table.push(row);
		});

		this.ui.write(table.toString());

		// Show pending changes notice if applicable
		if (hasPendingChanges) {
			this.ui.write('');
			this.ui.write(this.ui.chalk.yellow('⚠ There are pending changes that need to be applied.'));
			this.ui.write(this.ui.chalk.yellow(`Run 'particle config env rollout' or visit ${this.ui.chalk.cyan('https://console.particle.io')} to apply them.`));
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
		this._displayRolloutChanges(rolloutPreview);

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
