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
		ui.write(ui.chalk.yellow.bold('\nThere are pending changes that have not been applied yet.'));
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
	const tableRows = getTableRows(data, scope);

	if (tableRows.length === 0) {
		return 'No environment variables found.';
	}

	const widths = calculateColumnWidths(tableRows);
	if (!showOnDevice) {
		delete widths['On Device'];
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
			row.isOverriden
		]);
	});

	return table;
}

function getTableRows(data, scope) {
	const sortedKeys = getSortedEnvKeys(data);
	// eslint-disable-next-line no-nested-ternary
	const thisScope = (scope.sandbox || scope.org) ? 'Owner' : scope.product ? 'Product' : 'Device';

	return sortedKeys.map((key) => {
		return {
			key,
			onDeviceValue: data.on_device?.rendered?.[key] ?? 'missing',
			value: data.last_snapshot?.own?.[key]?.value ?? data.last_snapshot?.inherited?.[key]?.value ?? 'missing',
			scope: data.last_snapshot?.inherited?.[key]?.from ?? thisScope,
			isOverriden: data.last_snapshot?.inherited?.[key] && data.last_snapshot?.own?.[key] ? 'Yes' : 'No'
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
			url = `${baseUrl}/${productSlug}/devices/${scope.device}/environment`;
		} else {
			url = `${baseUrl}/devices/${scope.device}/environment`;
		}
	}
	ui.write('To review and save these changes in the Console, visit:');
	ui.write(ui.chalk.cyan(url));
}

module.exports = {
	getSortedEnvKeys,
	calculateColumnWidths,
	buildEnvTable,
	displayScopeTitle,
	displayEnv,
	displayRolloutInstructions
};

