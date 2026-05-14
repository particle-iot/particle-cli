'use strict';
const sinon = require('sinon');
const { expect } = require('../../test/setup');
const settings = require('../../settings');
const { optionalApiCall, requireToken } = require('./api-call');
const { AuthenticationError, InvalidTokenError, MissingTokenError } = require('./auth-errors');

describe('api-call', () => {
	describe('optionalApiCall', () => {
		it('returns the result of fn when it resolves', async () => {
			const result = await optionalApiCall(() => Promise.resolve('value'), 'fallback');
			expect(result).to.equal('value');
		});

		it('returns the fallback on AuthenticationError', async () => {
			const result = await optionalApiCall(
				() => Promise.reject(new AuthenticationError('nope')),
				'fallback'
			);
			expect(result).to.equal('fallback');
		});

		it('returns the fallback on InvalidTokenError (subtype)', async () => {
			const result = await optionalApiCall(
				() => Promise.reject(new InvalidTokenError()),
				null
			);
			expect(result).to.equal(null);
		});

		it('returns the fallback on MissingTokenError (subtype)', async () => {
			const result = await optionalApiCall(
				() => Promise.reject(new MissingTokenError()),
				{ default: true }
			);
			expect(result).to.deep.equal({ default: true });
		});

		it('re-throws any non-AuthenticationError', async () => {
			const generic = new Error('network');
			let caught;
			try {
				await optionalApiCall(() => Promise.reject(generic), 'fallback');
			} catch (err) {
				caught = err;
			}
			expect(caught).to.equal(generic);
		});

		it('re-throws a synchronous throw from fn', async () => {
			let caught;
			const throwingFn = () => {
				throw new TypeError('sync');
			};
			try {
				await optionalApiCall(throwingFn, 'fallback');
			} catch (err) {
				caught = err;
			}
			expect(caught).to.be.instanceof(TypeError);
		});
	});

	describe('requireToken', () => {
		let sandbox;

		beforeEach(() => {
			sandbox = sinon.createSandbox();
		});

		afterEach(() => {
			sandbox.restore();
		});

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

		it('defaults to settings.access_token when called without args', () => {
			sandbox.stub(settings, 'access_token').value('persisted-token');
			expect(() => requireToken()).to.not.throw();
		});

		it('throws MissingTokenError when called without args and settings.access_token is empty', () => {
			sandbox.stub(settings, 'access_token').value('');
			expect(() => requireToken()).to.throw(MissingTokenError);
		});
	});
});
