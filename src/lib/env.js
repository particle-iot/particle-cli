'use strict';
const os = require('os');
const Table = require('cli-table');

/**
 * Check if there are pending changes between snapshot and own environment variables
 * @param {Object} lastSnapshotRendered - The rendered snapshot data
 * @param {Object} envOwn - The own environment variables
 * @returns {boolean} True if there are pending changes
 */
function hasPendingChanges(lastSnapshotRendered, envOwn) {
	for (const key in envOwn) {
		if (!(key in lastSnapshotRendered) || lastSnapshotRendered[key] !== envOwn[key].value) {
			return true;
		}
	}
	return false;
}

/**
 * Get sorted environment variable keys from the data
 * @param {Object} data - The environment data
 * @returns {string[]} Sorted array of keys
 */
function getSortedEnvKeys(data) {
	const lastSnapshotRendered = data?.last_snapshot?.rendered || {};
	const envInherited = data?.env?.inherited || {};
	const allKeys = new Set([
		...Object.keys(lastSnapshotRendered),
		...Object.keys(envInherited)
	]);
	return Array.from(allKeys).sort();
}

/**
 * Resolve the value for a given environment variable key
 * @param {string} key - The environment variable key
 * @param {Object} data - The environment data
 * @returns {string} The resolved value
 */
function resolveValue(key, data) {
	const lastSnapshotRendered = data?.last_snapshot?.rendered || {};
	const envInherited = data?.env?.inherited || {};
	const envOwn = data?.env?.own || {};

	const snapshotValue = lastSnapshotRendered[key];
	const inheritedEntry = envInherited[key];
	const ownEntry = envOwn[key];

	if (snapshotValue !== undefined) {
		return snapshotValue;
	} else if (ownEntry) {
		return ownEntry.value;
	} else if (inheritedEntry) {
		return inheritedEntry.value;
	}
	return '';
}

/**
 * Resolve the scope and override status for a given environment variable
 * @param {string} key - The environment variable key
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters (sandbox, org, product, device)
 * @returns {Object} Object with scope and isOverridden properties
 */
function resolveScope(key, data, scope) {
	const lastSnapshotRendered = data?.last_snapshot?.rendered || {};
	const envInherited = data?.env?.inherited || {};
	const envOwn = data?.env?.own || {};
	const onDeviceData = data?.on_device || null;

	const snapshotValue = lastSnapshotRendered[key];
	const inheritedEntry = envInherited[key];
	const ownEntry = envOwn[key];

	const isInOwn = !!ownEntry;
	const isInherited = !!inheritedEntry;

	let envScope;
	let isOverridden = false;

	if (scope.sandbox || scope.org) {
		envScope = 'Organization';
	} else if (scope.product) {
		if (isInOwn) {
			envScope = 'Product';
			const isApplied = snapshotValue !== undefined && snapshotValue === ownEntry.value;
			isOverridden = isApplied && isInherited;
		} else if (inheritedEntry) {
			envScope = inheritedEntry.from === 'Product' ? 'Product' : 'Organization';
		}
	} else if (scope.device) {
		if (isInOwn) {
			envScope = 'Device';
			const isApplied = (snapshotValue !== undefined && snapshotValue === ownEntry.value) ||
				(onDeviceData && onDeviceData[key] !== undefined && onDeviceData[key] === ownEntry.value);
			isOverridden = isApplied && isInherited;
		} else if (inheritedEntry) {
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

	return { scope: envScope, isOverridden };
}

/**
 * Build a table row for an environment variable
 * @param {string} key - The environment variable key
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @param {Object} columnWidths - Column width settings
 * @returns {Array} Array representing the table row
 */
function buildEnvRow(key, data, scope, columnWidths) {
	const { valueWidth, onDeviceWidth } = columnWidths;
	const showOnDevice = !!scope.device;
	const onDeviceData = data?.on_device || null;

	const value = resolveValue(key, data);

	let onDeviceValue = 'missing';
	if (showOnDevice) {
		if (onDeviceData && onDeviceData[key] !== undefined) {
			onDeviceValue = onDeviceData[key];
		}
	}

	const { scope: envScope, isOverridden } = resolveScope(key, data, scope);

	const displayValue = value && value.length > valueWidth - 3
		? value.substring(0, valueWidth - 6) + '...'
		: value;

	const displayOnDeviceValue = onDeviceValue && onDeviceValue.length > onDeviceWidth - 3
		? onDeviceValue.substring(0, onDeviceWidth - 6) + '...'
		: onDeviceValue;

	const row = [key, displayValue || ''];

	if (showOnDevice) {
		row.push(displayOnDeviceValue);
	}

	row.push(envScope || '', isOverridden ? 'Yes' : 'No');

	return row;
}

/**
 * Build the complete environment variables table
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @returns {Table} The constructed table
 */
function buildEnvTable(data, scope) {
	const showOnDevice = !!scope.device;
	const nameWidth = 25;
	const valueWidth = 30;
	const onDeviceWidth = 15;
	const scopeWidth = 20;
	const overriddenWidth = 12;

	const columnWidths = { nameWidth, valueWidth, onDeviceWidth, scopeWidth, overriddenWidth };

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

	const sortedKeys = getSortedEnvKeys(data);
	sortedKeys.forEach((key) => {
		const row = buildEnvRow(key, data, scope, columnWidths);
		table.push(row);
	});

	return table;
}

/**
 * Display environment variables in a formatted table
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @param {Object} ui - UI instance for writing output
 */
function displayEnv(data, scope, ui) {
	const lastSnapshotRendered = data?.last_snapshot?.rendered || {};
	const envInherited = data?.env?.inherited || {};
	const envOwn = data?.env?.own || {};

	const hasLastSnapshot = Object.keys(lastSnapshotRendered).length > 0;
	const hasInherited = Object.keys(envInherited).length > 0;
	const hasOwn = Object.keys(envOwn).length > 0;

	if (!hasLastSnapshot && !hasInherited && !hasOwn) {
		ui.write('No environment variables found.');
		return;
	}

	const pendingChanges = hasPendingChanges(lastSnapshotRendered, envOwn);

	const table = buildEnvTable(data, scope);
	ui.write(table.toString());

	if (pendingChanges) {
		ui.write('');
		ui.write(ui.chalk.yellow('⚠ There are pending changes that need to be applied.'));
		ui.write(ui.chalk.yellow(`visit ${ui.chalk.cyan('https://console.particle.io')} to apply them.`));
	}
}

/**
 * Display rollout changes in a formatted way
 * @param {Object} rolloutData - The rollout data with changes and unchanged variables
 * @param {Object} ui - UI instance for writing output
 */
function displayRolloutChanges(rolloutData, ui) {
	const { changes, unchanged } = rolloutData;

	ui.write(ui.chalk.bold('Environment Variable Rollout Details:'));
	ui.write('------------------------------------------------');

	if (changes && changes.length > 0) {
		ui.write(ui.chalk.cyan.bold('Changes to be applied:'));
		changes.forEach(change => {
			if (change.op === 'Added') {
				ui.write(`  ${ui.chalk.green('+')} ${change.key}: ${change.after}`);
			} else if (change.op === 'Removed') {
				ui.write(`  ${ui.chalk.red('-')} ${change.key}`);
			} else if (change.op === 'Changed') {
				ui.write(`  ${ui.chalk.yellow('~')} ${change.key}: ${ui.chalk.red(change.before)} -> ${ui.chalk.green(change.after)}`);
			}
		});
	} else {
		ui.write(ui.chalk.gray('No changes to be applied.'));
	}

	if (unchanged && Object.keys(unchanged).length > 0) {
		ui.write(ui.chalk.bold(`${os.EOL}Unchanged environment variables:`));
		Object.entries(unchanged).forEach(([key, value]) => {
			ui.write(`  ${key}: ${value}`);
		});
	}
	ui.write('------------------------------------------------');
}

module.exports = {
	hasPendingChanges,
	getSortedEnvKeys,
	resolveValue,
	resolveScope,
	buildEnvRow,
	buildEnvTable,
	displayEnv,
	displayRolloutChanges
};

