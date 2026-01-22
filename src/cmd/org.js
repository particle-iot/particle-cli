'use strict';

const os = require('os');
const fs = require('fs-extra');
const VError = require('verror');
const settings = require('../../settings');
const ParticleAPI = require('./api');
const { normalizedApiError } = require('../lib/api-client');
const CLICommandBase = require('./base');

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const PER_PAGE = 1000;

module.exports = class OrgCommand extends CLICommandBase {
	constructor(...args) {
		super(...args);
	}

	async exportDevices({ format = 'csv', product, group, output, params: { org } }) {
		// Validate format
		const formatLower = format.toLowerCase();
		if (formatLower !== 'csv' && formatLower !== 'json') {
			throw new Error('Format must be either "csv" or "json"');
		}

		const api = createAPI();
		const allDevices = [];
		let page = 1;
		let totalPages = 1;
		let totalRecords = 0;

		this.ui.stdout.write(`Exporting devices from organization ${org}...${os.EOL}`);

		// Fetch all pages with progress display
		while (page <= totalPages) {
			const result = await this._fetchPageWithRetry(api, {
				orgSlug: org,
				format: 'json', // Always fetch as JSON for processing
				page,
				perPage: PER_PAGE,
				productIds: product,
				groupIds: group
			});

			if (page === 1) {
				totalRecords = result.meta.total_records;
				totalPages = result.meta.total_pages;

				if (totalRecords === 0) {
					this.ui.stdout.write(`No devices found.${os.EOL}`);
					return;
				}

				this.ui.stdout.write(`Found ${totalRecords} devices across ${totalPages} page(s)${os.EOL}`);
			}

			allDevices.push(...result.devices);

			// Show progress
			const progress = Math.min(100, Math.round((allDevices.length / totalRecords) * 100));
			this.ui.stdout.write(`\rFetching... ${progress}% (${allDevices.length}/${totalRecords} devices)`);

			page++;
		}

		this.ui.stdout.write(`${os.EOL}`);

		// Format output
		let outputContent;
		if (formatLower === 'json') {
			outputContent = JSON.stringify({ devices: allDevices, meta: { total_records: totalRecords } }, null, 2);
		} else {
			outputContent = this._generateCsv(allDevices);
		}

		// Write output
		if (output) {
			await fs.writeFile(output, outputContent, 'utf8');
			this.ui.stdout.write(`Exported ${allDevices.length} devices to ${output}${os.EOL}`);
		} else {
			this.ui.stdout.write(outputContent);
			if (!outputContent.endsWith(os.EOL)) {
				this.ui.stdout.write(os.EOL);
			}
		}
	}

	async _fetchPageWithRetry(api, options, attempt = 1) {
		try {
			return await api.exportOrgDevices(options);
		} catch (error) {
			// Check if it's an authorization/validation error (400/401) - don't retry these
			// The API wrapper converts 400/401 to UnauthorizedError
			if (error.name === 'UnauthorizedError' || error.statusCode === 400 || error.statusCode === 401) {
				throw new Error(error.message || 'Bad request');
			}

			// Retry for transient failures
			if (attempt < MAX_RETRIES && this._isRetryableError(error)) {
				const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
				this.ui.stderr.write(`${os.EOL}Request failed, retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...${os.EOL}`);
				await this._sleep(delay);
				return this._fetchPageWithRetry(api, options, attempt + 1);
			}

			const message = 'Error exporting organization devices';
			throw createAPIErrorResult({ error, message });
		}
	}

	_isRetryableError(error) {
		// Retry on network errors, timeouts, and 5xx server errors
		if (!error.statusCode) {
			return true; // Network error
		}
		return error.statusCode >= 500 && error.statusCode < 600;
	}

	_sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	_generateCsv(devices) {
		const headers = [
			'Device ID',
			'Device Name',
			'Product ID',
			'Platform ID',
			'Online',
			'Last Heard',
			'Serial Number',
			'ICCID',
			'Groups',
			'Firmware Version'
		];

		const rows = devices.map(device => {
			return [
				this._escapeCsvField(device.id || ''),
				this._escapeCsvField(device.name || ''),
				device.product_id || '',
				device.platform_id || '',
				device.online ? 'true' : 'false',
				device.last_heard || '',
				this._escapeCsvField(device.serial_number || ''),
				this._escapeCsvField(device.iccid || ''),
				this._escapeCsvField((device.groups || []).join(';')),
				this._escapeCsvField(device.firmware_version || '')
			].join(',');
		});

		return [headers.join(','), ...rows].join(os.EOL);
	}

	_escapeCsvField(value) {
		if (value === null || value === undefined) {
			return '';
		}
		const str = String(value);
		// Escape if contains comma, newline, or double quote
		if (str.includes(',') || str.includes('\n') || str.includes('"')) {
			return `"${str.replace(/"/g, '""')}"`;
		}
		return str;
	}
};


// UTILS //////////////////////////////////////////////////////////////////////
function createAPI() {
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}

function createAPIErrorResult({ error: e, message }) {
	return new VError(normalizedApiError(e), message);
}
