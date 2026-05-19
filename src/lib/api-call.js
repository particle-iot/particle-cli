'use strict';
const settings = require('../../settings');
const { AuthenticationError, MissingTokenError } = require('./auth-errors');
const { createParticleApi } = require('./api-factory');

const DEFAULT_FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000;

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

function requireToken(token = settings.access_token) {
	if (!token) {
		throw new MissingTokenError();
	}
}

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

function clearActiveAccessToken() {
	settings.override(null, 'access_token', null);
	settings.override(null, 'access_token_expires_at', null);
}

async function verifyFreshTokenMiddleware({ thresholdMs = DEFAULT_FRESHNESS_THRESHOLD_MS } = {}) {
	requireToken();

	if (settings.access_token_expires_at === null) {
		return;
	}

	let expiresAtStr = settings.access_token_expires_at;

	if (!expiresAtStr) {
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
			return;
		}
		if (expiresAtStr === null) {
			return;
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
