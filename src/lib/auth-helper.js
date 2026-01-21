'use strict';

const chalk = require('chalk');
const settings = require('../../settings');
const log = require('./log');

/**
 * Cache staleness threshold: 1 week in milliseconds
 */
const CACHE_STALE_THRESHOLD = 604800000;

/**
 * Standardized authentication error messages
 */
const AUTH_MESSAGES = {
	REQUIRED_LOGIN: `You're not logged in. Please login using ${chalk.bold.cyan('particle login')} before using this command`,
	TOKEN_EXPIRED: 'Your access token has expired. Please login again.',
	TOKEN_INVALID: `Your access token is invalid. Please login using ${chalk.bold.cyan('particle login')}`,
	NON_INTERACTIVE_EXPIRED: `Access token expired. In non-interactive mode, please refresh your token manually using ${chalk.bold.cyan('particle login')}`,
	NON_INTERACTIVE_MISSING: `Not logged in. In non-interactive mode, please login using ${chalk.bold.cyan('particle login')} first`,
	AUTO_REAUTH_DISABLED: `Access token expired. Auto-reauth is disabled. Please run ${chalk.bold.cyan('particle login')} to refresh your token.`,
	CACHE_STALE: 'Using cached data from {ageHuman} ago. Consider reconnecting for fresh data.'
};

/**
 * Authentication error reasons
 */
const AUTH_ERROR_REASONS = {
	EXPIRED: 'expired',
	INVALID: 'invalid',
	MISSING: 'missing'
};

/**
 * Checks if the current environment is interactive (TTY)
 * @returns {boolean}
 */
function isInteractive() {
	return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Checks if auto-reauth is enabled in settings
 * @returns {boolean}
 */
function isAutoReauthEnabled() {
	// Default to true if not explicitly set to false
	return settings.autoReauth !== false;
}

/**
 * Checks if auto-reauth should be attempted based on settings and environment
 * @returns {boolean}
 */
function shouldAutoReauth() {
	return isInteractive() && isAutoReauthEnabled();
}

/**
 * Checks if a valid access token exists (non-throwing)
 * @returns {boolean}
 */
function hasValidToken() {
	return Boolean(settings.access_token);
}

/**
 * Determines the reason for an auth error based on error message patterns
 * @param {Error} error - The error to analyze
 * @returns {string} - One of AUTH_ERROR_REASONS values
 */
function getAuthErrorReason(error) {
	if (!error) {
		return AUTH_ERROR_REASONS.MISSING;
	}

	const message = (error.message || '').toLowerCase();

	if (message.includes('expired')) {
		return AUTH_ERROR_REASONS.EXPIRED;
	}

	if (message.includes('invalid') || message.includes('unauthorized')) {
		return AUTH_ERROR_REASONS.INVALID;
	}

	// Check for missing token scenario
	if (!settings.access_token) {
		return AUTH_ERROR_REASONS.MISSING;
	}

	return AUTH_ERROR_REASONS.INVALID;
}

/**
 * Identifies if an error is authentication-related
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
function isAuthError(error) {
	if (!error) {
		return false;
	}

	// Check for UnauthorizedError by name
	if (error.name === 'UnauthorizedError') {
		return true;
	}

	// Check for explicit isAuthError flag
	if (error.isAuthError === true) {
		return true;
	}

	// Check for HTTP status codes indicating auth failure
	if ([400, 401, 403].includes(error.statusCode)) {
		return true;
	}

	// Check error message patterns
	const message = (error.message || '').toLowerCase();
	const authPatterns = [
		'invalid access token',
		'access token',
		'unauthorized',
		'authentication required',
		'not logged in',
		'token expired',
		'invalid token'
	];

	return authPatterns.some(pattern => message.includes(pattern));
}

/**
 * Identifies if an error is connectivity-related (not auth)
 * @param {Error} error - The error to check
 * @returns {boolean}
 */
function isConnectivityError(error) {
	if (!error) {
		return false;
	}

	const message = (error.message || '').toUpperCase();
	const connectivityPatterns = [
		'ECONNREFUSED',
		'ENOTFOUND',
		'ETIMEDOUT',
		'ECONNRESET',
		'NETWORK ERROR',
		'SOCKET HANG UP',
		'EAI_AGAIN'
	];

	return connectivityPatterns.some(pattern => message.includes(pattern));
}

/**
 * Gets the appropriate error message based on context
 * @param {Object} options
 * @param {string} options.reason - The auth error reason
 * @param {boolean} options.interactive - Whether session is interactive
 * @param {boolean} options.autoReauthEnabled - Whether auto-reauth is enabled
 * @returns {string}
 */
function getAuthErrorMessage({ reason, interactive, autoReauthEnabled }) {
	if (!interactive) {
		if (reason === AUTH_ERROR_REASONS.MISSING) {
			return AUTH_MESSAGES.NON_INTERACTIVE_MISSING;
		}
		return AUTH_MESSAGES.NON_INTERACTIVE_EXPIRED;
	}

	if (!autoReauthEnabled) {
		return AUTH_MESSAGES.AUTO_REAUTH_DISABLED;
	}

	switch (reason) {
		case AUTH_ERROR_REASONS.MISSING:
			return AUTH_MESSAGES.REQUIRED_LOGIN;
		case AUTH_ERROR_REASONS.EXPIRED:
			return AUTH_MESSAGES.TOKEN_EXPIRED;
		case AUTH_ERROR_REASONS.INVALID:
		default:
			return AUTH_MESSAGES.TOKEN_INVALID;
	}
}

/**
 * Formats cache age in human-readable format
 * @param {number} ageMs - Age in milliseconds
 * @returns {string}
 */
function formatCacheAge(ageMs) {
	const seconds = Math.floor(ageMs / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const weeks = Math.floor(days / 7);

	if (weeks > 0) {
		return `${weeks} week${weeks > 1 ? 's' : ''}`;
	}
	if (days > 0) {
		return `${days} day${days > 1 ? 's' : ''}`;
	}
	if (hours > 0) {
		return `${hours} hour${hours > 1 ? 's' : ''}`;
	}
	if (minutes > 0) {
		return `${minutes} minute${minutes > 1 ? 's' : ''}`;
	}
	return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Checks if cached data is stale (older than 1 week)
 * @param {number} ageMs - Age in milliseconds
 * @returns {boolean}
 */
function isCacheStale(ageMs) {
	return ageMs > CACHE_STALE_THRESHOLD;
}

/**
 * Logs cache staleness warning if data is older than threshold
 * @param {Object} options
 * @param {number} options.ageMs - Cache age in milliseconds
 * @param {string} [options.context] - Additional context for the log message
 */
function logCacheStalenessWarning({ ageMs, context = '' }) {
	if (isCacheStale(ageMs)) {
		const ageHuman = formatCacheAge(ageMs);
		const message = AUTH_MESSAGES.CACHE_STALE.replace('{ageHuman}', ageHuman);
		log.warn(context ? `${message} (${context})` : message);
	}
}

/**
 * Ensures authentication is available, with optional auto-reauth
 * @param {Object} options
 * @param {boolean} [options.required=true] - Whether auth is required (throws if missing)
 * @param {boolean} [options.interactive] - Override interactive detection
 * @returns {Promise<boolean>} - Returns true if authenticated, false if optional and not authenticated
 * @throws {Error} - Throws if required and not authenticated (after reauth attempts in interactive mode)
 */
async function ensureAuth({ required = true, interactive = isInteractive() } = {}) {
	// Check if we have a token
	if (hasValidToken()) {
		return true;
	}

	// No token available
	if (!required) {
		log.verbose('Auth optional, no token available');
		return false;
	}

	// Required auth but no token
	const reason = AUTH_ERROR_REASONS.MISSING;

	if (interactive && isAutoReauthEnabled()) {
		log.verbose('No token available, initiating login...');
		// Dynamically import to avoid circular dependency
		const CloudCommand = require('../cmd/cloud');
		const cloud = new CloudCommand();

		try {
			await cloud.login({});
			return hasValidToken();
		} catch (_error) {
			// Login failed or was cancelled
			const message = getAuthErrorMessage({ reason, interactive, autoReauthEnabled: true });
			throw new Error(message);
		}
	}

	// Non-interactive or auto-reauth disabled
	const message = getAuthErrorMessage({
		reason,
		interactive,
		autoReauthEnabled: isAutoReauthEnabled()
	});
	throw new Error(message);
}

/**
 * Attempts to re-authenticate after an auth error
 * @param {Error} error - The original auth error
 * @param {Object} options
 * @param {boolean} [options.interactive] - Override interactive detection
 * @returns {Promise<boolean>} - Returns true if reauth succeeded
 */
async function attemptReauth(error, { interactive = isInteractive() } = {}) {
	if (!interactive || !isAutoReauthEnabled()) {
		return false;
	}

	const reason = getAuthErrorReason(error);
	log.verbose(`Re-authenticating due to ${reason} token...`);

	// Dynamically import to avoid circular dependency
	const CloudCommand = require('../cmd/cloud');
	const cloud = new CloudCommand();

	try {
		await cloud.login({});
		return hasValidToken();
	} catch (loginError) {
		log.verbose('Re-authentication failed:', loginError.message);
		return false;
	}
}

/**
 * Wraps a function with authentication handling, including auto-reauth and cache fallback
 * @param {Function} fn - The async function to execute
 * @param {Object} options
 * @param {boolean} [options.optional=false] - Whether auth is optional (graceful degradation)
 * @param {boolean} [options.interactive] - Override interactive detection
 * @param {Function} [options.fallback] - Fallback function to call on auth failure (e.g., return cached data)
 * @param {string} [options.context] - Context string for logging
 * @returns {Promise<*>} - Result of fn, or fallback result on optional auth failure
 */
async function tryWithAuth(fn, { optional = false, interactive = isInteractive(), fallback, context = '' } = {}) {
	try {
		return await fn();
	} catch (error) {
		// Check if it's a connectivity error first
		if (isConnectivityError(error)) {
			log.verbose(`Offline, ${context ? `${context}: ` : ''}connectivity error:`, error.message);

			if (fallback) {
				const fallbackResult = await fallback();
				if (fallbackResult !== undefined) {
					return fallbackResult;
				}
			}

			if (optional) {
				log.verbose(`Auth optional, continuing without data${context ? ` (${context})` : ''}`);
				return undefined;
			}

			throw error;
		}

		// Check if it's an auth error
		if (!isAuthError(error)) {
			throw error;
		}

		const reason = getAuthErrorReason(error);

		// Try to re-authenticate if in interactive mode
		if (interactive && isAutoReauthEnabled()) {
			const reauthSuccess = await attemptReauth(error, { interactive });

			if (reauthSuccess) {
				// Retry the original function after successful reauth
				try {
					return await fn();
				} catch (retryError) {
					// If it fails again after reauth, handle based on optional flag
					if (!isAuthError(retryError)) {
						throw retryError;
					}
					// Fall through to optional/fallback handling
				}
			}
		}

		// Auth failed and reauth not possible or failed
		if (fallback) {
			log.verbose(`Auth failed, using fallback${context ? ` (${context})` : ''}:`, error.message);
			const fallbackResult = await fallback();
			if (fallbackResult !== undefined) {
				return fallbackResult;
			}
		}

		if (optional) {
			log.verbose(`Auth optional, continuing without user data${context ? ` (${context})` : ''}:`, error.message);
			return undefined;
		}

		// Required auth failed
		const message = getAuthErrorMessage({
			reason,
			interactive,
			autoReauthEnabled: isAutoReauthEnabled()
		});

		if (!interactive) {
			log.warn(message);
		}

		throw new Error(message);
	}
}

/**
 * Creates an enhanced error with auth metadata
 * @param {string} message - Error message
 * @param {Object} options
 * @param {number} [options.statusCode] - HTTP status code
 * @param {string} [options.reason] - Auth error reason
 * @returns {Error}
 */
function createAuthError(message, { statusCode, reason } = {}) {
	const error = new Error(message);
	error.name = 'UnauthorizedError';
	error.isAuthError = true;
	error.statusCode = statusCode;
	error.reason = reason || getAuthErrorReason(error);

	if (typeof Error.captureStackTrace === 'function') {
		Error.captureStackTrace(error, createAuthError);
	}

	return error;
}

module.exports = {
	// Constants
	AUTH_MESSAGES,
	AUTH_ERROR_REASONS,
	CACHE_STALE_THRESHOLD,

	// Detection functions
	isInteractive,
	isAutoReauthEnabled,
	shouldAutoReauth,
	hasValidToken,
	isAuthError,
	isConnectivityError,
	getAuthErrorReason,

	// Auth functions
	ensureAuth,
	attemptReauth,
	tryWithAuth,

	// Error handling
	getAuthErrorMessage,
	createAuthError,

	// Cache helpers
	formatCacheAge,
	isCacheStale,
	logCacheStalenessWarning
};

