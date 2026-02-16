'use strict';
const os = require('os');
const Table = require('cli-table');
const settings = require('../../settings');

/**
 * Resolve the scope and override status for a given environment variable
 * @param {string} key - The environment variable key
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters (sandbox, org, product, device)
 * @returns {Object} Object with scope and isOverridden properties
 */
function resolveScope(key, lastSnapshotData, scope) {
	const lastSnapshotInherited = lastSnapshotData?.inherited || {};
	const lastSnapshotOwn = lastSnapshotData?.own || {};

	const inheritedEntry = lastSnapshotInherited[key];
	const isInOwn = key in lastSnapshotOwn;
	const isInherited = !!inheritedEntry;

	let envScope;
	let isOverridden = false;

	if (scope.sandbox || scope.org) {
		envScope = 'Organization';
	} else if (scope.product) {
		if (isInOwn) {
			envScope = 'Product';
			isOverridden = isInherited;
		} else if (inheritedEntry) {
			const fromField = inheritedEntry.from || '';
			if (fromField === 'Product') {
				envScope = 'Product';
			} else if (fromField === 'Firmware') {
				envScope = 'Firmware';
			} else {
				envScope = 'Organization';
			}
		}
	} else if (scope.device) {
		if (isInOwn) {
			envScope = 'Device';
			isOverridden = isInherited;
		} else if (inheritedEntry) {
			const fromField = inheritedEntry.from || '';
			if (fromField === 'Device') {
				envScope = 'Device';
			} else if (fromField === 'Product') {
				envScope = 'Product';
			} else if (fromField === 'Firmware') {
				envScope = 'Firmware';
			} else {
				envScope = 'Organization';
			}
		}
	}

	return { scope: envScope, isOverridden };
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

	const hasSnapshotValues = Object.keys(lastSnapshotRendered).length > 0;
	const pendingChanges = hasPendingChanges(lastSnapshotRendered, envOwn, envInherited);

	await displayScopeTitle(scope, ui, api);

	if (!hasSnapshotValues) {
		ui.write('No environment variables found.');
	} else {
		const table = buildEnvTable(data, scope);
		ui.write(table.toString());
	}

	if (pendingChanges) {
		ui.write(ui.chalk.yellow.bold('There are pending changes that have not been applied yet.'));
		await displayRolloutInstructions(scope, ui, api);
	}
}

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
		const effective = envOwn[key]?.value ?? envInherited[key]?.value;
		const snapVal = key in lastSnapshotRendered ? snap : undefined;
		if (snapVal !== effective) {
			return true;
		}
	}
	return false;
}

async function displayScopeTitle(scope, ui, api = null) {
	const label = await resolveScopeLabel(scope, api);
	ui.write(ui.chalk.bold(`Scope: ${label}`));
	ui.write('');
}

async function resolveScopeLabel(scope, api) {
	if (scope.sandbox) {
		return 'Sandbox';
	}
	if (scope.org) {
		return `Organization (${scope.org})`;
	}
	if (scope.product) {
		const productName = await getProductName(scope.product, api);
		return `Product (${productName})`;
	}
	if (scope.device) {
		return `Device (${scope.device})`;
	}
}

async function getProductName(productSlug, api) {
	try {
		const productData = await api.getProduct({
			product: productSlug,
			auth: api.accessToken
		});
		return productData?.product?.name || productSlug;
	} catch {
		return productSlug;
	}
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
	const columnWidths = calculateColumnWidths(sortedKeys, data, scope);
	const { nameWidth, valueWidth, onDeviceWidth, scopeWidth, overriddenWidth } = columnWidths;
	const headers = ['Name'];
	const colWidths = [nameWidth];

	if (showOnDevice) {
		headers.push('On Device');
		colWidths.push(onDeviceWidth);
	}

	headers.push('Value', 'Scope', 'Overridden');
	colWidths.push(valueWidth, scopeWidth, overriddenWidth);

	const table = new Table({
		head: headers,
		colWidths: colWidths,
		style: { head: ['cyan', 'bold'] },
		wordWrap: true
	});

	sortedKeys.forEach((key) => {
		const row = buildEnvRow(key, data.last_snapshot, data.on_device, scope);
		table.push(row);
	});

	return table;
}

/**
 * Get sorted environment variable keys from the data.
 * The key set is the union of on_device keys (if any) and last_snapshot.rendered keys.
 * @param {Object} data - The environment data
 * @returns {string[]} Sorted array of keys
 */
function getSortedEnvKeys(data) {
	const latestValues = data?.last_snapshot?.rendered || {};
	const onDeviceRendered = data?.on_device?.rendered || {};
	const allKeys = new Set([
		...Object.keys(latestValues),
		...Object.keys(onDeviceRendered)
	]);
	return Array.from(allKeys).sort();
}

/**
 * Calculate dynamic column widths based on content
 * @param {string[]} sortedKeys - Sorted array of environment variable keys
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @returns {Object} Object with calculated column widths
 */
function calculateColumnWidths(sortedKeys, data, scope) {
	const showOnDevice = Boolean(scope.device);
	const onDeviceData = data?.on_device?.rendered ?? null;
	const latestValues = data?.last_snapshot?.rendered || {};

	const widths = {
		name: 'Name'.length,
		value: 'Value'.length,
		onDevice: 'On Device'.length,
		scope: 'Scope'.length,
		overridden: 'Overridden'.length
	};

	const updateWidth = (key, content) => {
		if (content) {
			widths[key] = Math.max(widths[key], content.length);
		}
	};

	for (const key of sortedKeys) {
		updateWidth('name', key);
		const value = latestValues[key] ?? '';
		updateWidth('value', value);
		if (showOnDevice) {
			const onDeviceValue =
				onDeviceData && onDeviceData[key] !== undefined
					? onDeviceData[key]
					: 'missing';

			updateWidth('onDevice', onDeviceValue);
		}
		const { scope: envScope } = resolveScope(key, data.last_snapshot, scope);
		updateWidth('scope', envScope);
	}
	for (const col of Object.keys(widths)) {
		widths[col] += 2;
	}

	return {
		nameWidth: widths.name,
		valueWidth: widths.value,
		onDeviceWidth: widths.onDevice,
		scopeWidth: widths.scope,
		overriddenWidth: widths.overridden
	};
}

/**
 * Build a table row for an environment variable
 * @param {string} key - The environment variable key
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @returns {Array} Array representing the table row
 */
function buildEnvRow(key, lastSnapshotData, onDeviceData, scope) {
	const showOnDevice = !!scope.device;
	const value = lastSnapshotData.rendered[key] ?? '';

	const onDeviceValue = showOnDevice && onDeviceData?.rendered[key] !== undefined
		? onDeviceData.rendered[key]
		: 'missing';

	const { scope: envScope, isOverridden } = resolveScope(key, lastSnapshotData, scope);

	const row = [key];

	if (showOnDevice) {
		row.push(onDeviceValue);
	}

	row.push(value || '', envScope || '', isOverridden ? 'Yes' : 'No');

	return row;
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
	resolveScope,
	calculateColumnWidths,
	buildEnvRow,
	buildEnvTable,
	displayScopeTitle,
	displayEnv,
	displayRolloutChanges,
	displayRolloutInstructions
};

