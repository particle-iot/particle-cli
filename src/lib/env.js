'use strict';
const Table = require('cli-table');
const settings = require('../../settings');
const _ = require('lodash');

/**
 * Display environment variables in a formatted table
 * @param {Object} data - The environment data
 * @param {Object} scope - The scope parameters
 * @param {Object} ui - UI instance for writing output
 * @param {Object} api - API instance for fetching device information (required for device scope with pending changes)
 */
async function displayEnv(data, scope, ui, api = null) {
	const pendingChanges = !_.isEqual(data.last_snapshot?.own, data.latest?.own);

	await displayScopeTitle(scope, ui, api);

	const table = buildEnvTable(data, scope);
	ui.write(table.toString());

	if (pendingChanges) {
		ui.write('');
		ui.write(ui.chalk.white.bold('Pending changes'));
		ui.write(buildPendingChangesTable(data, ui).toString());
		ui.write('');
		await displayRolloutInstructions(scope, ui, api);
	}
}

async function displayScopeTitle(scope, ui, api = null) {
	let label = 'Sandbox';

	if (scope.org) {
		label = `Organization (${scope.org})`;
	}
	if (scope.product) {
		const productName = await getProductName(scope.product, api);
		label = `Product (${productName})`;
	}
	if (scope.device) {
		label = `Device (${scope.device})`;
	}
	ui.write(ui.chalk.bold(`Scope: ${label}`));
	ui.write('');
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
 * @returns {Table|String} The constructed table or a message if no variables are found
 */
function buildEnvTable(data, scope) {
	const showOnDevice = !!scope.device;
	const hideOverridden = scope.sandbox || scope.org;
	const tableRows = getTableRows(data, scope);

	if (tableRows.length === 0) {
		return 'No environment variables found.';
	}

	const widths = calculateColumnWidths(tableRows);
	if (!showOnDevice) {
		delete widths['On Device'];
	}

	if (hideOverridden) {
		delete widths['Overridden'];
	}
	const head = Object.keys(widths);
	const colWidths = Object.values(widths);

	const table = new Table({
		head,
		colWidths,
		style: { head: ['cyan', 'bold'] },
		wordWrap: true
	});

	tableRows.forEach((row) => {
		table.push([
			row.key,
			...(showOnDevice ? [row.onDeviceValue] : []),
			row.value,
			row.scope,
			...(!hideOverridden ? [row.isOverridden] : [])
		]);
	});

	return table;
}

function getTableRows(data, scope) {
	const sortedKeys = getSortedEnvKeys(data);
	// eslint-disable-next-line no-nested-ternary
	const thisScope = scope.sandbox ? 'Sandbox' : scope.org ? 'Organization' : scope.product ? 'Product' : 'Device';

	return sortedKeys.map((key) => {
		return {
			key,
			onDeviceValue: data.on_device?.rendered?.[key] ?? EM_DASH,
			value: data.last_snapshot?.own?.[key]?.value ?? data.last_snapshot?.inherited?.[key]?.value ?? EM_DASH,
			scope: data.last_snapshot?.inherited?.[key]?.from ?? thisScope,
			isOverridden: data.last_snapshot?.inherited?.[key] && data.last_snapshot?.own?.[key] ? 'Yes' : 'No'
		};
	});
}

function getSortedEnvKeys(data) {
	return Object.keys({
		...data.last_snapshot?.own,
		...data.last_snapshot?.inherited,
		...data.on_device?.rendered
	}).sort();
}

function calculateColumnWidths(tableRows) {
	const columns = ['Name', 'On Device', 'Value', 'Scope', 'Overridden'];
	const widths = Object.fromEntries(columns.map(col => [col, col.length]));

	const updateWidth = (key, content) => {
		if (content) {
			widths[key] = Math.max(widths[key], content.length);
		}
	};

	for (const row of tableRows) {
		updateWidth('Name', row.key);
		updateWidth('On Device', row.onDeviceValue);
		updateWidth('Value', row.value);
		updateWidth('Scope', row.scope);
	}

	for (const col of Object.keys(widths)) {
		widths[col] += 2;
	}

	return widths;
}

const CHANGE_ORDER = { 'Added': 0, 'Updated': 1, 'Removed': 2 };
const EM_DASH = '\u2014';

function buildPendingChangesTable(data, ui) {
	const snapshotOwn = data.last_snapshot?.own || {};
	const latestOwn = data.latest?.own || {};
	const allKeys = [...new Set([...Object.keys(snapshotOwn), ...Object.keys(latestOwn)])];

	const rows = [];
	for (const key of allKeys) {
		const inSnapshot = key in snapshotOwn;
		const inLatest = key in latestOwn;

		if (inSnapshot && inLatest && snapshotOwn[key].value === latestOwn[key].value) {
			continue;
		}

		let change;
		if (!inSnapshot && inLatest) {
			change = 'Added';
		} else if (inSnapshot && !inLatest) {
			change = 'Removed';
		} else {
			change = 'Updated';
		}

		rows.push({
			change,
			name: key,
			oldValue: inSnapshot ? snapshotOwn[key].value : EM_DASH,
			newValue: inLatest ? latestOwn[key].value : EM_DASH
		});
	}

	rows.sort((a, b) => (CHANGE_ORDER[a.change] - CHANGE_ORDER[b.change]) || a.name.localeCompare(b.name));

	const colorFn = {
		'Added': (s) => ui.chalk.green.bold(s),
		'Updated': (s) => ui.chalk.yellow.bold(s),
		'Removed': (s) => ui.chalk.red.bold(s)
	};

	const columns = ['Change', 'Name', 'Old value', 'New value'];
	const widths = Object.fromEntries(columns.map(col => [col, col.length]));

	for (const row of rows) {
		widths['Change'] = Math.max(widths['Change'], row.change.length);
		widths['Name'] = Math.max(widths['Name'], row.name.length);
		widths['Old value'] = Math.max(widths['Old value'], row.oldValue.length);
		widths['New value'] = Math.max(widths['New value'], row.newValue.length);
	}

	for (const col of columns) {
		widths[col] += 2;
	}

	const table = new Table({
		head: columns,
		colWidths: Object.values(widths),
		style: { head: ['cyan', 'bold'] },
		wordWrap: true
	});

	for (const row of rows) {
		table.push([colorFn[row.change](row.change), row.name, row.oldValue, row.newValue]);
	}

	return table;
}

/**
 * Display instructions for applying the rollout with the appropriate console URL
 * @param {Object} scope - The scope parameters (sandbox, org, product, device)
 * @param {Object} ui - UI instance for writing output
 * @param {Object} api - API instance for fetching device information (required for device scope)
 * @returns {Promise<void>}
 */
async function displayRolloutInstructions(scope, ui, api = null) {
	const url = await getConsoleEnvSaveUrl(scope, api);
	ui.write('To review and save these changes in the Console, visit:');
	ui.write(ui.chalk.cyan(url));
}

async function getConsoleEnvSaveUrl(scope, api) {
	const baseUrl = `https://console${settings.isStaging ? '.staging' : ''}.particle.io`;
	if (scope.sandbox) {
		return `${baseUrl}/env/edit`;
	}
	if (scope.org) {
		return `${baseUrl}/orgs/${scope.org}/env/edit`;
	}
	if (scope.product) {
		const product = await api.getProduct({
			product: scope.product,
			auth: api.accessToken
		});
		return `${baseUrl}/${product?.product?.slug}/env/edit`;
	}
	if (scope.device) {
		const device = await api.getDevice({
			deviceId: scope.device,
			auth: api.accessToken
		});

		const product = await api.getProduct({
			product: device.body?.product_id,
			auth: api.accessToken
		});

		const productSlug = product?.product?.slug;

		if (productSlug) {
			return `${baseUrl}/${productSlug}/devices/${scope.device}/environment`;
		}
		return `${baseUrl}/devices/${scope.device}/environment`;
	}
}

module.exports = {
	getSortedEnvKeys,
	calculateColumnWidths,
	buildEnvTable,
	buildPendingChangesTable,
	displayScopeTitle,
	displayEnv,
	displayRolloutInstructions
};

