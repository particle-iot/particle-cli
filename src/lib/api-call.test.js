'use strict';
const { expect } = require('../../test/setup');
const { optionalApiCall } = require('./api-call');
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
});
