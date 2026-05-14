'use strict';
const settings = require('../../settings');
const { AuthenticationError, MissingTokenError } = require('./auth-errors');

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

module.exports = {
	optionalApiCall,
	requireToken
};
