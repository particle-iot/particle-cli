'use strict';
const chalk = require('chalk');
const VError = require('verror');
const settings = require('../../settings');
const ApiClient = require('./api-client');
const CloudCommand = require('../cmd/cloud');

/**
 * Unified authentication error handler for Particle CLI
 * Strategy: Pre-flight validation → Execute → Clear error (no re-login on failure)
 */
class AuthHandler {
	constructor({ ui = null, ApiClient: ApiClientOverride = null } = {}) {
		this.ui = ui;
		this._ApiClient = ApiClientOverride || ApiClient;
	}

	/**
	 * Detects if an error is authentication-related
	 * @param {Error} error - The error to check
	 * @returns {boolean} - True if error is auth-related
	 */
	isAuthError(error) {
		if (!error) {
			return false;
		}

		// Check for auth-related status codes
		if (error.statusCode === 401 || error.statusCode === 403) {
			return true;
		}

		// Check for invalid_token error (this can come with 400 or other codes)
		if (error.error && typeof error.error === 'string' && error.error.includes('invalid_token')) {
			return true;
		}

		// Check for error body with invalid_token
		if (error.body && error.body.error && typeof error.body.error === 'string') {
			if (error.body.error.includes('invalid_token')) {
				return true;
			}
		}

		// Check for UnauthorizedError by name
		if (error.name === 'UnauthorizedError') {
			return true;
		}

		// Check for common auth error messages using regex patterns
		const message = error.message || '';
		const authPatterns = [
			/not\s+logged\s+in/i,
			/invalid.*token/i,
			/token.*invalid/i,
			/token.*expired/i,
			/expired.*token/i,
			/unauthorized/i,
			/authentication.*failed/i,
			/authentication.*required/i
		];

		return authPatterns.some(pattern => pattern.test(message));
	}

	/**
	 * Checks if a token exists in settings
	 * @returns {boolean} - True if token exists
	 */
	hasToken() {
		return !!settings.access_token;
	}

	/**
	 * Validates token by calling the API
	 * @returns {Promise<boolean>} - True if token is valid
	 */
	async validateToken() {
		if (!this.hasToken()) {
			return false;
		}

		try {
			const api = new this._ApiClient();
			await api.getCurrentToken();
			return true;
		} catch (_error) {
			// If API call fails, token is invalid
			return false;
		}
	}

	/**
	 * Triggers login flow using CloudCommand
	 * @param {Object} ui - UI instance for display (optional if set in constructor)
	 * @returns {Promise<string>} - New access token
	 */
	async promptLogin(ui = this.ui) {
		if (!ui) {
			throw new Error('UI instance is required for login prompt');
		}
		const cloud = new CloudCommand();

		ui.write(chalk.yellow('⚠ Authentication required. Please login.'));
		return await cloud.login();
	}

	/**
	 * Handles authentication errors - returns fallback for optional auth or throws clear error
	 * @param {Error} error - The error to handle
	 * @param {Object} options - Handler options
	 * @param {boolean} [options.optional=false] - Auth is optional, return fallback instead of throwing
	 * @param {*} [options.fallback=null] - Value to return if auth is optional and fails
	 * @returns {Promise<*>} - Returns fallback if optional, otherwise throws
	 */
	async handleAuthError(error, { optional = false, fallback = null } = {}) {
		if (!this.isAuthError(error)) {
			throw error; // Not an auth error, re-throw
		}

		// If auth is optional, return fallback
		if (optional) {
			return fallback;
		}

		// Auth is required but failed - throw user-friendly error
		if (!this.hasToken()) {
			throw new VError(`You're not logged in. Please login using ${chalk.bold.cyan('particle login')} before using this command`);
		} else {
			throw new VError(`Your access token has expired or is invalid. Please login using ${chalk.bold.cyan('particle login')}`);
		}
	}

	/**
	 * Ensures a valid token exists before executing (pre-flight check)
	 * Throws clear error if validation fails
	 * @param {Object} options - Validation options
	 * @param {boolean} [options.validateToken=false] - Also validate token via API call
	 * @throws {VError} - If no token or token is invalid
	 */
	async ensureToken({ validateToken: shouldValidate = false } = {}) {
		if (!this.hasToken()) {
			throw new VError(`You're not logged in. Please login using ${chalk.bold.cyan('particle login')} before using this command`);
		}

		if (shouldValidate) {
			const isValid = await this.validateToken();
			if (!isValid) {
				throw new VError(`Your access token has expired or is invalid. Please login using ${chalk.bold.cyan('particle login')}`);
			}
		}
	}

	/**
	 * Ensures valid token with interactive login prompt if needed (pre-flight)
	 * Use for commands that are already interactive
	 * @param {Object} ui - UI instance (optional if set in constructor)
	 * @param {Object} options - Validation options
	 * @param {boolean} [options.validateToken=false] - Also validate token via API call
	 */
	async ensureTokenWithLogin(ui = this.ui, { validateToken: shouldValidate = false } = {}) {
		if (!ui) {
			throw new Error('UI instance is required for interactive login');
		}

		// Check if token exists
		if (!this.hasToken()) {
			if (!global.isInteractive) {
				throw new VError(`You're not logged in. Please login using ${chalk.bold.cyan('particle login')} before using this command`);
			}
			await this.promptLogin(ui);
			return;
		}

		// Check token validity via API if requested
		if (shouldValidate) {
			const isValid = await this.validateToken();
			if (!isValid) {
				if (!global.isInteractive) {
					throw new VError(`Your access token has expired or is invalid. Please login using ${chalk.bold.cyan('particle login')}`);
				}
				await this.promptLogin(ui);
			}
		}
	}

	/**
	 * Wraps a function with required auth - pre-flight validation, then execute
	 * Use for non-interactive commands that require auth
	 * @param {Function} fn - Function to wrap
	 * @param {Object} options - Wrapper options
	 * @param {boolean} [options.validateToken=false] - Validate token via API before executing
	 * @returns {Promise<*>} - Result of fn
	 */
	async withRequiredAuth(fn, { validateToken: shouldValidate = false } = {}) {
		// Pre-flight validation
		await this.ensureToken({ validateToken: shouldValidate });

		try {
			return await fn();
		} catch (error) {
			// If auth error during execution, throw clear error (no re-login)
			if (this.isAuthError(error)) {
				throw new VError(`Your access token is invalid. Please login using ${chalk.bold.cyan('particle login')} and try again`);
			}
			throw error;
		}
	}

	/**
	 * Wraps a function with optional auth - execute and return fallback on auth failure
	 * Use for commands like `usb list` that can degrade gracefully
	 * @param {Function} fn - Function to wrap
	 * @param {Object} options - Wrapper options
	 * @param {*} [options.fallback=null] - Fallback value if auth fails
	 * @returns {Promise<*>} - Result of fn or fallback
	 */
	async withOptionalAuth(fn, { fallback = null } = {}) {
		// No pre-flight check - execute and handle errors
		try {
			return await fn();
		} catch (error) {
			return this.handleAuthError(error, { optional: true, fallback });
		}
	}

	/**
	 * Wraps a function with interactive auth - pre-flight login prompt, then execute
	 * Use for commands that are already interactive (setup, create, etc.)
	 * @param {Function} fn - Function to wrap
	 * @param {Object} options - Wrapper options
	 * @param {Object} [options.ui] - UI instance (optional if set in constructor)
	 * @param {boolean} [options.validateToken=false] - Validate token via API before executing
	 * @returns {Promise<*>} - Result of fn
	 */
	async withInteractiveAuth(fn, { ui = this.ui, validateToken: shouldValidate = false } = {}) {
		if (!ui) {
			throw new Error('UI instance is required for interactive auth');
		}

		// Pre-flight validation with login prompt
		await this.ensureTokenWithLogin(ui, { validateToken: shouldValidate });

		try {
			return await fn();
		} catch (error) {
			// If auth error during execution, throw clear error (no re-login)
			if (this.isAuthError(error)) {
				throw new VError(`Authentication failed. Please run ${chalk.bold.cyan('particle login')} and try again`);
			}
			throw error;
		}
	}
}

// Export singleton instance
module.exports = new AuthHandler();
