'use strict';
const os = require('os');
const fetch = require('node-fetch');
const ParticleCache = require('../particle-cache');

// The toolchain manifest Workbench uses: one entry per Device OS version, each
// pinning the Device OS source, gcc-arm, buildtools and buildscripts to install.
const MANIFEST_URL = 'https://binaries.particle.io/toolchain-manager/manifest.json';
const MANIFEST_CACHE_KEY = 'toolchain-manifest';
const MANIFEST_TIMEOUT_MS = 4000;

// The dependency kinds a local compile needs, in the order the environment is
// built from them. `debuggers` (openocd) is deliberately left out.
const DEPENDENCY_KINDS = ['firmware', 'compilers', 'tools', 'scripts'];

const DISPLAY_NAMES = {
	deviceOS: 'Device OS'
};

/**
 * Maps the running machine to the manifest's os/arch buckets. Only x64 buckets
 * exist. Apple Silicon runs the x64 toolchain under Rosetta, as Workbench does.
 * @param {{ platform: string, arch: string }} [host]
 * @returns {{ os: string, arch: string }}
 */
function hostFor({ platform = os.platform(), arch = os.arch() } = {}) {
	const osName = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[platform];
	const supported = osName && (arch === 'x64' || (osName === 'darwin' && arch === 'arm64'));
	if (!supported) {
		throw new Error(`Local compile is not available for ${platform}/${arch}; use --compiler cloud`);
	}
	return { os: osName, arch: 'x64' };
}

function displayName(dependency) {
	return `${DISPLAY_NAMES[dependency.name] || dependency.name} ${dependency.version}`;
}

class ToolchainManifest {
	constructor(json) {
		if (!json || !Array.isArray(json.toolchains) || !Array.isArray(json.platforms)) {
			throw new Error('Invalid toolchain manifest');
		}
		this.json = json;
	}

	/** @returns {object|undefined} the platform entry for a name or id */
	platform(nameOrId) {
		return this.json.platforms.find(p => p.name === nameOrId || `${p.id}` === `${nameOrId}`);
	}

	/** @returns {object|undefined} the toolchain entry for a Device OS version */
	toolchainForVersion(version) {
		return this.json.toolchains.find(t => t.version === version);
	}

	/** @returns {object[]} toolchains that support the platform, in manifest order */
	toolchainsForPlatform(platformId) {
		return this.json.toolchains.filter(t => t.platforms.includes(platformId));
	}

	/**
	 * Workbench's rule: the toolchain whose `default_platforms` lists the platform,
	 * else the one flagged `default`.
	 * @returns {object|undefined}
	 */
	defaultToolchain(platformId) {
		return this.json.toolchains.find(t => (t.default_platforms || []).includes(platformId)) ||
			this.json.toolchains.find(t => t.default);
	}

	/**
	 * Resolves the toolchain a compile should use, or throws listing the versions
	 * that would work.
	 * @param {{ version?: string, platformId: number, platformName: string }} opts
	 * @returns {object}
	 */
	resolveToolchain({ version, platformId, platformName }) {
		if (!version || version === 'latest') {
			const toolchain = this.defaultToolchain(platformId);
			if (!toolchain) {
				throw new Error(`No default Device OS version for ${platformName} in the toolchain manifest`);
			}
			return toolchain;
		}
		const toolchain = this.toolchainForVersion(version);
		if (!toolchain || !toolchain.platforms.includes(platformId)) {
			const valid = this.toolchainsForPlatform(platformId)
				.map(t => `${t.version}${t.release_state === 'preview' ? ' (preview)' : ''}`);
			throw new Error(['Invalid build target version.', `Valid targets for ${platformName}:`].concat(valid).join('\n'));
		}
		return toolchain;
	}

	/**
	 * The four dependencies a toolchain needs on this host, in DEPENDENCY_KINDS order.
	 * Each is `{ name, version, main, url, sha256, paths? }` as found in the manifest.
	 * @param {object} toolchain
	 * @param {{ os: string, arch: string }} host
	 * @returns {object[]}
	 */
	dependenciesFor(toolchain, host) {
		return DEPENDENCY_KINDS.map((kind) => {
			const id = toolchain[kind];
			const [name, version] = id.split('@');
			const pool = kind === 'firmware'
				? this.json.firmware
				: ((this.json[kind] || {})[host.os] || {})[host.arch];
			const dependency = (pool || []).find(d => d.name === name && d.version === version);
			if (!dependency) {
				throw new Error(`The toolchain manifest has no ${id} for ${host.os}/${host.arch}`);
			}
			return dependency;
		});
	}
}

/**
 * Fetches the manifest, using the cached copy when the server says it is
 * unchanged or cannot be reached. Throws only when there is neither.
 * @param {object} [opts]
 * @param {ParticleCache} [opts.cache]
 * @param {string} [opts.url]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<ToolchainManifest>}
 */
async function fetchManifest({ cache = new ParticleCache(), url = MANIFEST_URL, timeoutMs = MANIFEST_TIMEOUT_MS } = {}) {
	const cached = cache.get(MANIFEST_CACHE_KEY);
	const headers = cached && cached.etag ? { 'If-None-Match': cached.etag } : {};
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, { headers, signal: controller.signal });
		if (response.status === 304 && cached) {
			return new ToolchainManifest(cached.data);
		}
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const data = await response.json();
		const manifest = new ToolchainManifest(data);
		cache.set(MANIFEST_CACHE_KEY, { etag: response.headers.get('etag'), data, fetchedAt: Date.now() });
		return manifest;
	} catch (error) {
		if (cached) {
			return new ToolchainManifest(cached.data);
		}
		throw new Error(`Could not download the toolchain manifest: ${error.message}. Check your connection and retry`);
	} finally {
		clearTimeout(timeout);
	}
}

module.exports = {
	MANIFEST_URL,
	MANIFEST_CACHE_KEY,
	DEPENDENCY_KINDS,
	ToolchainManifest,
	fetchManifest,
	hostFor,
	displayName
};
