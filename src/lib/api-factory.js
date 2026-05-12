'use strict';
const settings = require('../../settings');
const ApiCache = require('./api-cache');

/**
 * Single source of truth for `ApiCache` (and therefore `ParticleApi`) construction.
 *
 * Returns `{ api, auth }`:
 *   - `api`: a fresh `ApiCache` configured against the current `settings.access_token`.
 *   - `auth`: the access token at the moment of construction (kept for callers that need
 *      to pass it through to lower-level helpers).
 *
 * Callers should not new up `ApiCache` or `ParticleApi` directly — use this so the
 * construction shape stays consistent across the codebase.
 */
function createParticleApi() {
	const auth = settings.access_token;
	const api = new ApiCache(settings.apiUrl, { accessToken: auth });
	return { api, auth };
}

module.exports = { createParticleApi };
