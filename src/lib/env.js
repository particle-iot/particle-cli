'use strict';
const os = require('os');
const Table = require('cli-table');
const settings = require('../../settings');

/**
 * Check if there are pending changes between snapshot and own environment variables
 * @param {Object} lastSnapshotRendered - The rendered snapshot data
 * @param {Object} envOwn - The own environment variables
 * @param {Object} envInherited - The inherited environment variables
 * @returns {boolean} True if there are pending changes
 */
function hasPendingChanges(lastSnapshotRendered, envOwn, envInherited = {}) {
	const keys = new Set([
		...Object.keys(lastSnapshotRendered),
		...Object.keys(envOwn)
	]);

	for (const key of keys) {
		const snap = lastSnapshotRendered[key];

		// Own overrides inherited; if neither exists, value is undefined
		const effective = envOwn[key]?.value ?? envInherited[key]?.value;

		// If snapshot has no entry for this key, treat as undefined too
		const snapVal = key in lastSnapshotRendered ? snap : undefined;

		if (snapVal !== effective) {
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
 * @returns {Array} Array representing the table row
 */
function buildEnvRow(key, data, scope) {
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

	const row = [key, value || ''];

	if (showOnDevice) {
		row.push(onDeviceValue);
	}

	row.push(envScope || '', isOverridden ? 'Yes' : 'No');

	return row;
}

/**
 * Calculate dynamic column widths based on content
 * @param {string[]} sortedKeys - Sorted array of environment variable keys
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @returns {Object} Object with calculated column widths
 */
function calculateColumnWidths(sortedKeys, data, scope) {
	const showOnDevice = !!scope.device;
	const onDeviceData = data?.on_device || null;

	// Minimum widths for headers and basic content
	let nameWidth = 'Name'.length;
	let valueWidth = 'Value'.length;
	let onDeviceWidth = 'On Device'.length;
	let scopeWidth = 'Scope'.length;
	let overriddenWidth = 'Overridden'.length;

	// Calculate maximum widths based on actual content
	sortedKeys.forEach((key) => {
		// Name column
		nameWidth = Math.max(nameWidth, key.length);

		// Value column
		const value = resolveValue(key, data);
		if (value) {
			valueWidth = Math.max(valueWidth, value.length);
		}

		// On Device column
		if (showOnDevice) {
			let onDeviceValue = 'missing';
			if (onDeviceData && onDeviceData[key] !== undefined) {
				onDeviceValue = onDeviceData[key];
			}
			if (onDeviceValue) {
				onDeviceWidth = Math.max(onDeviceWidth, onDeviceValue.length);
			}
		}

		// Scope column
		const { scope: envScope } = resolveScope(key, data, scope);
		if (envScope) {
			scopeWidth = Math.max(scopeWidth, envScope.length);
		}
	});

	// Add some padding to make it more readable
	nameWidth += 2;
	valueWidth += 2;
	onDeviceWidth += 2;
	scopeWidth += 2;
	overriddenWidth += 2;

	return { nameWidth, valueWidth, onDeviceWidth, scopeWidth, overriddenWidth };
}

/**
 * Build the complete environment variables table
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @returns {Table} The constructed table
 */
function buildEnvTable(data, scope) {
	const showOnDevice = !!scope.device;
	const sortedKeys = getSortedEnvKeys(data);

	// Calculate dynamic column widths
	const columnWidths = calculateColumnWidths(sortedKeys, data, scope);
	const { nameWidth, valueWidth, onDeviceWidth, scopeWidth, overriddenWidth } = columnWidths;

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

	sortedKeys.forEach((key) => {
		const row = buildEnvRow(key, data, scope);
		table.push(row);
	});

	return table;
}

/**
 * Display the scope title
 * @param {Object} scope - The scope parameters
 * @param {Object} ui - UI instance for writing output
 * @param {Object} api - API instance for fetching additional information
 */
async function displayScopeTitle(scope, ui, api = null) {
	let title = 'Scope: ';

	if (scope.sandbox) {
		title += 'Sandbox';
	} else if (scope.org) {
		title += `Organization (${scope.org})`;
	} else if (scope.product) {
		// Try to get product name if api is available
		if (api) {
			try {
				const productData = await api.getProduct({ product: scope.product, auth: api.accessToken });
				const productName = productData?.product?.name || scope.product;
				title += `Product (${productName})`;
			} catch (_error) {
				// Fall back to product ID if we can't get the name
				title += `Product (${scope.product})`;
			}
		} else {
			title += `Product (${scope.product})`;
		}
	} else if (scope.device) {
		title += `Device (${scope.device})`;
	}

	ui.write(ui.chalk.bold(title));
	ui.write('');
}

/**
 * Display environment variables in a formatted table
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @param {Object} ui - UI instance for writing output
 * @param {Object} api - API instance for fetching device information (required for device scope with pending changes)
 */
async function displayEnv(data, scope, ui, api = null) {
	const lastSnapshotRendered = data?.last_snapshot?.rendered || {};
	const envInherited = data?.env?.inherited || {};
	const envOwn = data?.env?.own || {};

	const hasLastSnapshot = Object.keys(lastSnapshotRendered).length > 0;
	const hasInherited = Object.keys(envInherited).length > 0;
	const hasOwn = Object.keys(envOwn).length > 0;

	// Display scope title
	await displayScopeTitle(scope, ui, api);

	if (!hasLastSnapshot && !hasInherited && !hasOwn) {
		ui.write('No environment variables found.');
		return;
	}

	const pendingChanges = hasPendingChanges(lastSnapshotRendered, envOwn, envInherited);

	const table = buildEnvTable(data, scope);
	ui.write(table.toString());

	if (pendingChanges) {
		ui.write(ui.chalk.yellow.bold('There are pending changes that have not been applied yet.'));
		await displayRolloutInstructions(scope, ui, api, true);
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

/**
 * Display instructions for applying the rollout with the appropriate console URL
 * @param {Object} scope - The scope parameters (sandbox, org, product, device)
 * @param {Object} ui - UI instance for writing output
 * @param {Object} api - API instance for fetching device information (required for device scope)
 * @returns {Promise<void>}
 */
async function displayRolloutInstructions(scope, ui, api = null) {
	const baseUrl = `https://console${settings.isStaging ? '.staging' : ''}.particle.io`;
	let url;

	if (scope.sandbox) {
		url = `${baseUrl}/env/edit`;
	} else if (scope.org) {
		url = `${baseUrl}/orgs/${scope.org}/env/edit`;
	} else if (scope.product) {
		url = `${baseUrl}/${scope.product}/env/edit`;
	} else if (scope.device) {
		if (!api) {
			throw new Error('API instance is required to get device information');
		}
		const device = await api.getDevice({ deviceId: scope.device, auth: api.accessToken });
		const product = await api.getProduct({ product: device.body?.product_id, auth: api.accessToken });
		const productSlug = product?.product?.slug;

		if (productSlug) {
			url = `${baseUrl}/${productSlug}/devices/${scope.device}/env/edit`;
		} else {
			url = `${baseUrl}/devices/${scope.device}/env/edit`;
		}
	}
	ui.write('To review and save this changes in the console');
	ui.write(`Visit ${ui.chalk.cyan(url)}`);
}

module.exports = {
	hasPendingChanges,
	getSortedEnvKeys,
	resolveValue,
	resolveScope,
	calculateColumnWidths,
	buildEnvRow,
	buildEnvTable,
	displayScopeTitle,
	displayEnv,
	displayRolloutChanges,
	displayRolloutInstructions
};

