'use strict';
const { AuthenticationError } = require('./auth-errors');

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

module.exports = {
	optionalApiCall
};
