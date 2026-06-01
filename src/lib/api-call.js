'use strict';
const settings = require('../../settings');
const { AuthenticationError, MissingTokenError } = require('./auth-errors');
const { createParticleApi } = require('./api-factory');

const DEFAULT_FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000;
const NEVER_EXPIRES_SENTINEL = '9999-12-31T23:59:59.999Z';

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

async function refreshTokenExpiry(api) {
	if (!api) {
		({ api } = createParticleApi());
	}
	const info = await api.getCurrentAccessToken();
	const expiresAt = info && info.expires_at ? info.expires_at : NEVER_EXPIRES_SENTINEL;
	settings.override(null, 'access_token_expires_at', expiresAt);
	return expiresAt;
}

async function getCurrentUsername() {
	if (settings.username) {
		return settings.username;
	}
	try {
		const { api } = createParticleApi();
		const info = await api.getUserInfo();
		if (info && info.username) {
			settings.override(null, 'username', info.username);
			return info.username;
		}
	} catch (err) {
		if (err instanceof AuthenticationError) {
			throw err;
		}
		// Non-auth error (network, etc.) — fall through to 'unknown'
	}
	return 'unknown';
}

async function verifyFreshTokenMiddleware({ thresholdMs = DEFAULT_FRESHNESS_THRESHOLD_MS, relogin = false } = {}) {
	try {
		requireToken();

		let expiresAtStr = settings.access_token_expires_at;

		if (!expiresAtStr) {
			try {
				expiresAtStr = await refreshTokenExpiry();
			} catch (err) {
				if (err instanceof AuthenticationError) {
					clearActiveAccessToken();
					throw new MissingTokenError();
				}
				return;
			}
		}
		const remaining = new Date(expiresAtStr).getTime() - Date.now();
		if (remaining < thresholdMs) {
			clearActiveAccessToken();
			throw new MissingTokenError();
		}
	} catch (err) {
		if (relogin && err instanceof MissingTokenError) {
			const CloudCommands = require('../cmd/cloud');
			await new CloudCommands().login();
			return;
		}
		throw err;
	}
}

module.exports = {
	DEFAULT_FRESHNESS_THRESHOLD_MS,
	optionalApiCall,
	requireToken,
	setActiveAccessToken,
	clearActiveAccessToken,
	verifyFreshTokenMiddleware,
	refreshTokenExpiry,
	getCurrentUsername
};
