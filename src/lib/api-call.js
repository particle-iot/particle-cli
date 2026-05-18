'use strict';
const settings = require('../../settings');
const { AuthenticationError, MissingTokenError } = require('./auth-errors');
const { createParticleApi } = require('./api-factory');

const DEFAULT_FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000;   // 5 minutes

/**
 * Run `fn()`; if it rejects with an `AuthenticationError`, return `fallback`
 * instead of propagating. Any other error is re-thrown unchanged.
 *
 * Use for read-only API calls where an auth failure is acceptable and a
 * sensible default exists — e.g. fetching a display-only device name for
 * UI output. Don't use for writes, where silently swallowing auth errors
 * would mask data loss.
 */
async function optionalApiCall(fn, fallback) {
	try {
		return await fn();
	} catch (err) {
		if (err instanceof AuthenticationError) {
			return fallback;
		}
		throw err;
	}
}

/**
 * Pre-flight check for commands that require authentication. Throws
 * `MissingTokenError` if no token is configured.
 *
 * Defaults to `settings.access_token` so call sites don't have to thread it
 * through. Pass an explicit token only when validating one that isn't (yet)
 * the persisted value (e.g. `login --token` verifying a user-supplied value
 * before persisting, or unit tests).
 */
function requireToken(token = settings.access_token) {
	if (!token) {
		throw new MissingTokenError();
	}
}

/**
 * Persist the active access token + its server-side expiry to the profile
 * config. Single point for every login site (`cloud.js` username/password,
 * MFA, `--token`, SSO) so the two fields can't drift.
 *
 * @param {object} args
 * @param {string} args.token          The access token to persist.
 * @param {number|null} [args.expiresIn]  Seconds until expiry from the server's
 *   token-issue response. `0` or `null` means "never expires" — we store
 *   `access_token_expires_at` as `null` to signal that. `undefined` means
 *   "expiry unknown" (e.g. `--token` flow, SSO) — we leave the existing
 *   `access_token_expires_at` value untouched and let the freshness
 *   middleware discover it on the next auth-required command.
 */
function setActiveAccessToken({ token, expiresIn } = {}) {
	settings.override(null, 'access_token', token || null);
	if (expiresIn === undefined) {
		return;
	}
	if (expiresIn === null || expiresIn === 0) {
		settings.override(null, 'access_token_expires_at', null);
		return;
	}
	const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
	settings.override(null, 'access_token_expires_at', expiresAt);
}

/**
 * Clear both `access_token` and `access_token_expires_at` from the profile
 * config. Called by logout, by the freshness middleware on near-expiry, and
 * by the command-processor post-flight on a reactive 401.
 */
function clearActiveAccessToken() {
	settings.override(null, 'access_token', null);
	settings.override(null, 'access_token_expires_at', null);
}

/**
 * Pre-flight token-freshness check. Wired into `command-processor.js` for
 * commands marked `authRequired: true`.
 *
 * Behaviour:
 *   - No token in the profile → throws `MissingTokenError` (sync).
 *   - `access_token_expires_at` is `null` → never-expires; resolves silently.
 *   - Profile-stored expiry exists and is fresh enough → resolves silently.
 *   - Profile-stored expiry exists but is within `thresholdMs` of now →
 *     clears local state + throws `MissingTokenError`.
 *   - Profile is missing the expiry → fetch from the server via
 *     `api.getCurrentAccessToken()`, persist the result, then re-check.
 *     If the server returns 401, clear + throw `MissingTokenError`.
 *     If the call fails with a non-auth error (network down), resolve
 *     silently and let the real command attempt the network on its own.
 *
 * @param {object} [options]
 * @param {number} [options.thresholdMs]  How much runway the token needs.
 *   Defaults to {@link DEFAULT_FRESHNESS_THRESHOLD_MS} (5 minutes). Override
 *   per-command via `commandSpec.tokenExpiryThresholdMs`.
 */
async function verifyFreshTokenMiddleware({ thresholdMs = DEFAULT_FRESHNESS_THRESHOLD_MS } = {}) {
	requireToken();   // sync; throws MissingTokenError when no token

	// `null` sentinel means "never expires" — created with `token create --never-expires`.
	if (settings.access_token_expires_at === null) {
		return;
	}

	let expiresAtStr = settings.access_token_expires_at;

	if (!expiresAtStr) {
		// Profile is missing the expiry (legacy install, `--token`/SSO login).
		// Ask the server, persist the result, then re-check freshness.
		const { api } = createParticleApi();
		try {
			const info = await api.getCurrentAccessToken();
			expiresAtStr = info && info.expires_at ? info.expires_at : null;
			settings.override(null, 'access_token_expires_at', expiresAtStr);
		} catch (err) {
			if (err instanceof AuthenticationError) {
				clearActiveAccessToken();
				throw new MissingTokenError();
			}
			return;   // Network/other error — non-fatal, let the real command try.
		}
		if (expiresAtStr === null) {
			return;   // newly stored "never-expires" sentinel
		}
	}

	const remaining = new Date(expiresAtStr).getTime() - Date.now();
	if (remaining < thresholdMs) {
		clearActiveAccessToken();
		throw new MissingTokenError();
	}
}

module.exports = {
	DEFAULT_FRESHNESS_THRESHOLD_MS,
	optionalApiCall,
	requireToken,
	setActiveAccessToken,
	clearActiveAccessToken,
	verifyFreshTokenMiddleware
};
