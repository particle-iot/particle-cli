

const os = require('node:os');
const fs = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const readline = require('node:readline');
const fetch = require('node-fetch');

const PARTICLE_CONFIG_DIR = path.join(os.homedir(), '.particle');
const PARTICLE_API_URL = 'https://api.particle.io';

/**
 * @typedef {object} Config
 * @property {string} [apiUrl]
 * @property {string} username
 * @property {string} access_token
 * @property {number} modifiedMs
 */

/**
 * @typedef {object} ConfigHostname
 * @property {Config} [active]
 * @property {Config[]} files
 */

/**
 * @typedef {Record<string, ConfigHostname>} ConfigHostnameMap
 */

/**
 *
 * @param {string} apiHost
 * @param {Config} config
 * @returns {Promise<boolean>}
 */
async function isTokenValid(apiHost, config) {
	const res = await fetch(`https://${apiHost}/v1/access_tokens/current`, {
		headers: {
			Authorization: `Bearer ${config.access_token}`
		}
	});
	return res.ok;
}

/**
 * @param {string} apiHost
 * @param {ConfigHostnameMap} configMap
 * @returns {Promise<Config | null>}
 */
async function findValidConfig(apiHost, configMap) {
	if (!configMap[apiHost]) {
		return null;
	}

	const configs = configMap[apiHost].files;
	if (configMap[apiHost].active) {
		configs.unshift(configMap[apiHost].active);
	}

	for (const config of configs) {
		if (await isTokenValid(apiHost, config)) {
			return config;
		}
	}
	return null;
}

const DEFAULT_PROFILE_NAME = 'particle';
/**
 * @returns {Promise<string>}
 */
async function getActiveProfileName() {
	try {
		/** @type {{ name?: string }} */
		const profile = JSON.parse(await fs.readFile(path.join(PARTICLE_CONFIG_DIR, 'profile.json'), 'utf-8'));
		return profile.name || DEFAULT_PROFILE_NAME;
	} catch (err) {
		return DEFAULT_PROFILE_NAME;
	}
}

/**
 * @returns {Promise<ConfigHostnameMap>}
 */
async function readAndSortParticleConfigFiles() {
	try {
		const filenames = await fs.readdir(PARTICLE_CONFIG_DIR);
		const activeProfileName = await getActiveProfileName();

		/** @type {ConfigHostnameMap} */
		const configApiMap = {};
		for (const filename of filenames) {
			const profileName = path.basename(filename, '.config.json');
			const filepath = path.join(PARTICLE_CONFIG_DIR, filename);
			if (!filename.endsWith('.config.json')) {
				continue;
			}

			/** @type {Config} */
			const config = JSON.parse(await fs.readFile(filepath, 'utf-8'));
			const stats = await fs.stat(filepath);
			config.modifiedMs = stats.mtimeMs;

			const hostname = getHostnameFromUrl(config.apiUrl ?? PARTICLE_API_URL);
			if (!hostname) {
				continue;
			}

			if (hostname in configApiMap) {
				configApiMap[hostname].files.push(config);
			} else {
				configApiMap[hostname] = {
					files: [config]
				};
			}
			if (activeProfileName === profileName) {
				configApiMap[hostname].active = config;
			}
		}

		// Sort them by modified time newest to oldest
		for (const apiUrl in configApiMap) {
			configApiMap[apiUrl].files.sort((a, b) => b.modifiedMs - a.modifiedMs);
		}

		return configApiMap;
	} catch (err) {
		console.error('Failed to read partile config dir files', err);
		process.exit(1);
	}
}

/**
 * @param {string} urlString
 * @returns {string | null}
 */
function getHostnameFromUrl(urlString) {
	try {
		if (!urlString.includes('://')) {
			urlString = `https://${urlString}`;
		}
		return new URL(urlString).hostname;
	} catch {
		return null;
	}
}

async function readStdin() {
	return new Promise((res) => {
		const rl = readline.createInterface({ input: process.stdin });

		let inputData = '';
		rl.on('line', (line) => {
			inputData += line;
		});

		rl.on('close', () => {
			res(inputData);
		});
	});
}

async function runGetCommand() {
	const inputData = await readStdin();

	const urlString = inputData.trim();
	// registry.particle.io, registry.staging.particle.io
	const host = getHostnameFromUrl(urlString);
	if (!host) { // Docker issue
		console.error(`invalid host: ${urlString}`);
		process.exit(1);
	}

	if (!host.endsWith('particle.io')) {
		console.error(`unsupported host: ${host}`);
		process.exit(1);
	}

	// Removes registry. to end up with: particle.io, staging.particle.io,
	const targetDomain = host.split('.').slice(1).join('.');
	const targetApiDomain = `api.${targetDomain}`;

	const configMap = await readAndSortParticleConfigFiles();
	const validConfig = await findValidConfig(targetApiDomain, configMap);
	if (validConfig) {
		const dockerCreds = {
			ServerURL: urlString,
			Username: validConfig.username,
			Secret: validConfig.access_token,
		};

		process.stdout.write(JSON.stringify(dockerCreds));
		process.exit(0);
	}

	console.error(`Unable to authenticate with ${urlString}. Please run "particle login"`);
	process.exit(1);
}

async function runListCommand() {
	/** @type {Record<string, string>} */
	const storedCredentials = {};

	const configMap = await readAndSortParticleConfigFiles();
	for (const hostname in configMap) {
		// Removes api from hostname
		const baseDomain = hostname.split('.').slice(1).join('.');
		const activeOrFirstConfig = configMap[hostname].active ?? configMap[hostname].files[0];

		storedCredentials[`registry.${baseDomain}`] = activeOrFirstConfig.username;
	}
	process.stdout.write(JSON.stringify(storedCredentials));
}

async function run() {
	const command = process.argv[2];
	// if executed with an arg of 'get' run the get command
	if (command === 'get') {
		await runGetCommand();
	} else if (command === 'list') {
		await runListCommand();
	} else { // store, erase
		console.error(`Unknown command ${command}`);
		process.exit(0);
	}
}

module.exports = {
	run,
};
