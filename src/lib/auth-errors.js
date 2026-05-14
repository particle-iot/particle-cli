'use strict';

class AuthenticationError extends Error {
	constructor(message) {
		super(message || 'Authentication failed');
		this.name = this.constructor.name;
		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

class MissingTokenError extends AuthenticationError {
	constructor(message) {
		super(message || 'You\'re not logged in. Run `particle login` to authenticate.');
		this.kind = 'missing';
	}
}

class InvalidTokenError extends AuthenticationError {
	constructor(message) {
		super(message || 'Your access token is invalid or has expired.');
		this.kind = 'invalid';
	}
}

class MfaRequiredError extends AuthenticationError {
	constructor({ mfaToken, message } = {}) {
		super(message || 'Multi-factor authentication required.');
		this.kind = 'mfa';
		this.mfaToken = mfaToken;
	}
}

function classifyAuthError(err) {
	if (err instanceof AuthenticationError) {
		return err;
	}

	const body = (err && err.body) || {};
	const bodyError = body.error || (err && err.error);

	if (bodyError === 'mfa_required') {
		return new MfaRequiredError({ mfaToken: body.mfa_token || err.mfa_token });
	}

	if (bodyError === 'invalid_token' || bodyError === 'expired_token') {
		return new InvalidTokenError(body.error_description || err.error_description);
	}

	if (err && err.statusCode === 401) {
		const msg = (err.shortErrorDescription)
			|| body.error_description
			|| body.error
			|| err.errorDescription;
		return new InvalidTokenError(msg);
	}

	// Some Particle endpoints (e.g. /v1/libraries) return 400 with an "access token"
	// description when the token is missing — OAuth2 `invalid_request` for a missing
	// parameter. Match on the body description so these collapse to InvalidTokenError
	// like every other auth failure.
	const description = body.error_description
		|| (err && err.shortErrorDescription)
		|| (err && err.error_description);
	if (description && /access token/i.test(description)) {
		return new InvalidTokenError(description);
	}

	return null;
}

/**
 * Wrap a `particle-api-js` `Client` so any rejection from a first-level method
 * call is routed through `classifyAuthError`. This lets library commands
 * surface auth failures as typed `AuthenticationError`s for the top-level
 * renderer, matching the rest of the CLI.
 *
 * Caveat — first-level only. When `client.libraries(...)` resolves with
 * `Library` instances, those hold a back-reference to the **original**
 * unwrapped client. A later `library.download()` calls `client.downloadFile`
 * through that unwrapped reference, bypassing the Proxy. If typed errors are
 * needed on those downstream calls, decorate the returned objects too.
 */
function wrapClientErrors(client) {
	return new Proxy(client, {
		get(target, prop) {
			const value = target[prop];
			if (typeof value !== 'function') {
				return value;
			}
			return (...args) => {
				const result = value.apply(target, args);
				if (result && typeof result.then === 'function') {
					return result.catch(err => {
						const typed = classifyAuthError(err);
						throw typed || err;
					});
				}
				return result;
			};
		}
	});
}

module.exports = {
	AuthenticationError,
	MissingTokenError,
	InvalidTokenError,
	MfaRequiredError,
	classifyAuthError,
	wrapClientErrors
};
