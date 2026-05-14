'use strict';
const path = require('path');
const { expect } = require('../../test/setup');
const {
	AuthenticationError,
	MissingTokenError,
	InvalidTokenError,
	MfaRequiredError,
	classifyAuthError,
	requireToken
} = require('./auth-errors');

const apiJsMfaRejectionFixture = require(path.resolve(__dirname, '../../test/__fixtures__/api-js-mfa-rejection.json'));

describe('auth-errors', () => {
	describe('class hierarchy', () => {
		it('MissingTokenError extends AuthenticationError', () => {
			const err = new MissingTokenError();
			expect(err).to.be.instanceof(AuthenticationError);
			expect(err.name).to.equal('MissingTokenError');
			expect(err.kind).to.equal('missing');
		});

		it('InvalidTokenError extends AuthenticationError', () => {
			const err = new InvalidTokenError();
			expect(err).to.be.instanceof(AuthenticationError);
			expect(err.name).to.equal('InvalidTokenError');
			expect(err.kind).to.equal('invalid');
		});

		it('MfaRequiredError extends AuthenticationError and carries mfaToken', () => {
			const err = new MfaRequiredError({ mfaToken: 'abc-123' });
			expect(err).to.be.instanceof(AuthenticationError);
			expect(err.name).to.equal('MfaRequiredError');
			expect(err.kind).to.equal('mfa');
			expect(err.mfaToken).to.equal('abc-123');
		});
	});

	describe('classifyAuthError', () => {
		it('returns existing AuthenticationError instances unchanged', () => {
			const original = new InvalidTokenError('original');
			expect(classifyAuthError(original)).to.equal(original);
		});

		it('maps HTTP 401 to InvalidTokenError', () => {
			const err = Object.assign(new Error('API Error'), {
				statusCode: 401,
				body: { error_description: 'Invalid token' }
			});
			const typed = classifyAuthError(err);
			expect(typed).to.be.instanceof(InvalidTokenError);
			expect(typed.message).to.equal('Invalid token');
		});

		it('maps body error invalid_token to InvalidTokenError', () => {
			const err = { body: { error: 'invalid_token', error_description: 'expired' } };
			const typed = classifyAuthError(err);
			expect(typed).to.be.instanceof(InvalidTokenError);
			expect(typed.message).to.equal('expired');
		});

		it('maps body error expired_token to InvalidTokenError', () => {
			const err = { body: { error: 'expired_token', error_description: 'gone' } };
			expect(classifyAuthError(err)).to.be.instanceof(InvalidTokenError);
		});

		it('maps mfa_required to MfaRequiredError with mfaToken', () => {
			const err = { body: { error: 'mfa_required', mfa_token: 'mfa-xyz' } };
			const typed = classifyAuthError(err);
			expect(typed).to.be.instanceof(MfaRequiredError);
			expect(typed.mfaToken).to.equal('mfa-xyz');
		});

		it('maps top-level mfa_required (no body) to MfaRequiredError', () => {
			const err = { error: 'mfa_required', mfa_token: 'mfa-top' };
			const typed = classifyAuthError(err);
			expect(typed).to.be.instanceof(MfaRequiredError);
			expect(typed.mfaToken).to.equal('mfa-top');
		});

		it('classifies the real particle-api-js MFA rejection envelope as MfaRequiredError', () => {
			const { _comment, message, ...props } = apiJsMfaRejectionFixture;
			const err = Object.assign(new Error(message), props);

			const typed = classifyAuthError(err);

			expect(typed).to.be.instanceof(MfaRequiredError);
			expect(typed.mfaToken).to.equal('mfa_token_fixture_abc123');
		});

		it('returns null for HTTP 403 (not an auth-class error)', () => {
			const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });
			expect(classifyAuthError(err)).to.equal(null);
		});

		it('returns null for HTTP 400 (request validation, not auth)', () => {
			const err = Object.assign(new Error('Bad Request'), {
				statusCode: 400,
				body: { error_description: 'Invalid operation' }
			});
			expect(classifyAuthError(err)).to.equal(null);
		});

		it('returns null for HTTP 500', () => {
			const err = Object.assign(new Error('Server Error'), { statusCode: 500 });
			expect(classifyAuthError(err)).to.equal(null);
		});

		it('returns null for null / undefined / empty', () => {
			expect(classifyAuthError(null)).to.equal(null);
			expect(classifyAuthError(undefined)).to.equal(null);
			expect(classifyAuthError({})).to.equal(null);
		});

		it('prefers shortErrorDescription when 401', () => {
			const err = Object.assign(new Error('API Error'), {
				statusCode: 401,
				shortErrorDescription: 'short',
				body: { error_description: 'long' }
			});
			expect(classifyAuthError(err).message).to.equal('short');
		});
	});

	describe('requireToken', () => {
		it('throws MissingTokenError when token is undefined', () => {
			expect(() => requireToken(undefined)).to.throw(MissingTokenError);
		});

		it('throws MissingTokenError when token is empty string', () => {
			expect(() => requireToken('')).to.throw(MissingTokenError);
		});

		it('throws MissingTokenError when token is null', () => {
			expect(() => requireToken(null)).to.throw(MissingTokenError);
		});

		it('returns silently when token is a non-empty string', () => {
			expect(() => requireToken('abc')).to.not.throw();
		});
	});
});
