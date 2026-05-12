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
		super(message || 'You\'re not logged in. Run `particle login` to get started.');
		this.kind = 'missing';
	}
}

class InvalidTokenError extends AuthenticationError {
	constructor(message) {
		super(message || 'Your access token is invalid or has expired. Run `particle login` to refresh.');
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

	return null;
}

function requireToken(token) {
	if (!token) {
		throw new MissingTokenError();
	}
}

module.exports = {
	AuthenticationError,
	MissingTokenError,
	InvalidTokenError,
	MfaRequiredError,
	classifyAuthError,
	requireToken
};
