'use strict';
const { URL } = require('node:url');
const HttpsProxyAgent = require('https-proxy-agent');

/**
 * Resolve an HTTP proxy agent for an outbound request, honoring the standard
 * `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` env vars (and their lowercase
 * equivalents).
 *
 * Used by both the main CLI (`src/cmd/api.js`) and the bundled
 * `docker-credential-particle` helper (`src/docker-credential-helper.js`) so
 * the two networking paths can't drift in proxy behavior.
 *
 * @param {string} targetUrl  The URL the request will be sent to. Used to
 *   match against `NO_PROXY` exclusions.
 * @param {object} [options]
 * @param {string} [options.proxyUrl]  Explicit proxy URL (e.g. from
 *   `settings.proxyUrl`). When provided, takes precedence over env vars.
 * @param {NodeJS.ProcessEnv} [options.env]  Environment object to read from.
 *   Defaults to `process.env`; injected for testing.
 * @returns {HttpsProxyAgent | undefined}  An agent suitable for the
 *   `agent` option of `node-fetch` / `request`, or `undefined` if no proxy
 *   applies.
 */
function getProxyAgent(targetUrl, { proxyUrl, env = process.env } = {}) {
	const resolved = proxyUrl
		|| env.HTTPS_PROXY || env.https_proxy
		|| env.HTTP_PROXY || env.http_proxy;
	if (!resolved) {
		return undefined;
	}

	if (isExcludedByNoProxy(targetUrl, env)) {
		return undefined;
	}

	return new HttpsProxyAgent(resolved);
}

/**
 * Decide whether `targetUrl`'s hostname is exempted by the current
 * `NO_PROXY` value.
 *
 * Supported `NO_PROXY` syntax:
 *   - `*` — exempt everything (i.e. never use a proxy).
 *   - Comma-separated list of hostnames.
 *   - Each entry can have an optional leading `.` for clarity; both
 *     `.example.com` and `example.com` exempt `example.com` and any subdomain
 *     of it (e.g. `api.example.com`).
 *
 * Not supported (intentionally — keeps the matcher simple and the behavior
 * predictable for the CLI's use case):
 *   - CIDR / IP-range matching.
 *   - Per-port entries (`example.com:8080`).
 *   - Scheme prefixes (`https://example.com`).
 *
 * @param {string} targetUrl
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
function isExcludedByNoProxy(targetUrl, env) {
	const raw = env.NO_PROXY || env.no_proxy;
	if (!raw) {
		return false;
	}

	const trimmed = raw.trim();
	if (trimmed === '*') {
		return true;
	}

	let hostname;
	try {
		hostname = new URL(targetUrl).hostname;
	} catch {
		return false;
	}
	if (!hostname) {
		return false;
	}

	const exclusions = trimmed.split(',')
		.map((entry) => entry.trim().replace(/^\./, '').toLowerCase())
		.filter(Boolean);

	const lowerHost = hostname.toLowerCase();
	return exclusions.some((entry) => lowerHost === entry || lowerHost.endsWith(`.${entry}`));
}

module.exports = {
	getProxyAgent,
	// Exposed for tests
	_isExcludedByNoProxy: isExcludedByNoProxy
};
