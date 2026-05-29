'use strict';
const sinon = require('sinon');
const { expect } = require('../../test/setup');
const settings = require('../../settings');
const apiCall = require('./api-call');
const {
	optionalApiCall,
	requireToken,
	setActiveAccessToken,
	clearActiveAccessToken,
	verifyFreshTokenMiddleware,
	DEFAULT_FRESHNESS_THRESHOLD_MS
} = apiCall;
const { AuthenticationError, InvalidTokenError, MissingTokenError } = require('./auth-errors');
const ParticleApi = require('../cmd/api');

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

	describe('setActiveAccessToken', () => {
		let sandbox;
		let overrideStub;

		beforeEach(() => {
			sandbox = sinon.createSandbox();
			overrideStub = sandbox.stub(settings, 'override');
		});

		afterEach(() => {
			sandbox.restore();
		});

		it('writes the token and computes expires_at when expiresIn is a positive number', () => {
			const before = Date.now();
			setActiveAccessToken({ token: 'tok', expiresIn: 7776000 });   // 90 days
			const after = Date.now();

			expect(overrideStub).to.have.been.calledWith(null, 'access_token', 'tok');

			const expiresAtCall = overrideStub.getCalls().find(c => c.args[1] === 'access_token_expires_at');
			expect(expiresAtCall).to.exist;
			const stored = new Date(expiresAtCall.args[2]).getTime();
			expect(stored).to.be.at.least(before + 7776000 * 1000);
			expect(stored).to.be.at.most(after + 7776000 * 1000);
		});

		it('writes token and sets expires_at to null when expiresIn is 0 (never-expires)', () => {
			setActiveAccessToken({ token: 'forever-token', expiresIn: 0 });
			expect(overrideStub).to.have.been.calledWith(null, 'access_token', 'forever-token');
			expect(overrideStub).to.have.been.calledWith(null, 'access_token_expires_at', null);
		});

		it('writes token and sets expires_at to null when expiresIn is null', () => {
			setActiveAccessToken({ token: 'tok', expiresIn: null });
			expect(overrideStub).to.have.been.calledWith(null, 'access_token_expires_at', null);
		});

		it('writes token and leaves expires_at untouched when expiresIn is undefined', () => {
			setActiveAccessToken({ token: 'tok' });
			expect(overrideStub).to.have.been.calledWith(null, 'access_token', 'tok');
			const touched = overrideStub.getCalls().some(c => c.args[1] === 'access_token_expires_at');
			expect(touched).to.equal(false);
		});

		it('clears access_token when token is empty', () => {
			setActiveAccessToken({ token: '', expiresIn: 100 });
			expect(overrideStub).to.have.been.calledWith(null, 'access_token', null);
		});
	});

	describe('clearActiveAccessToken', () => {
		let sandbox;
		let overrideStub;

		beforeEach(() => {
			sandbox = sinon.createSandbox();
			overrideStub = sandbox.stub(settings, 'override');
		});

		afterEach(() => {
			sandbox.restore();
		});

		it('clears both access_token and access_token_expires_at', () => {
			clearActiveAccessToken();
			expect(overrideStub).to.have.been.calledWith(null, 'access_token', null);
			expect(overrideStub).to.have.been.calledWith(null, 'access_token_expires_at', null);
		});
	});

	describe('verifyFreshTokenMiddleware', () => {
		let sandbox;
		let overrideStub;
		let getCurrentAccessTokenStub;

		const inFuture = (ms) => new Date(Date.now() + ms).toISOString();

		beforeEach(() => {
			sandbox = sinon.createSandbox();
			sandbox.stub(settings, 'access_token').value('a-real-token');
			overrideStub = sandbox.stub(settings, 'override');
			// Default: expiry comfortably in the future (1 day).
			sandbox.stub(settings, 'access_token_expires_at').value(inFuture(24 * 60 * 60 * 1000));
			// Stub at the prototype level — the middleware uses `createParticleApi()`
			// which returns an `ApiCache` that inherits `getCurrentAccessToken` from
			// `ParticleApi.prototype`. Module-level stubs of `createParticleApi` itself
			// wouldn't take effect because `api-call.js` already destructured the
			// import at load time.
			getCurrentAccessTokenStub = sandbox.stub(ParticleApi.prototype, 'getCurrentAccessToken');
		});

		afterEach(() => {
			sandbox.restore();
		});

		it('throws MissingTokenError synchronously when no token is configured', async () => {
			settings.access_token = '';
			let caught;
			try {
				await verifyFreshTokenMiddleware();
			} catch (err) {
				caught = err;
			}
			expect(caught).to.be.instanceof(MissingTokenError);
		});

		it('resolves silently when expires_at is in the future and beyond threshold', async () => {
			await verifyFreshTokenMiddleware();   // default 5-min threshold; expiry is 1 day out
			expect(getCurrentAccessTokenStub).to.have.property('callCount', 0);
		});

		it('clears local state and throws MissingTokenError when remaining < thresholdMs', async () => {
			settings.access_token_expires_at = inFuture(60 * 1000);   // 1 minute out
			let caught;
			try {
				await verifyFreshTokenMiddleware();   // default 5-min threshold
			} catch (err) {
				caught = err;
			}
			expect(caught).to.be.instanceof(MissingTokenError);
			expect(overrideStub).to.have.been.calledWith(null, 'access_token', null);
			expect(overrideStub).to.have.been.calledWith(null, 'access_token_expires_at', null);
		});

		it('respects a custom thresholdMs', async () => {
			settings.access_token_expires_at = inFuture(20 * 60 * 1000);   // 20 minutes out
			let caught;
			try {
				await verifyFreshTokenMiddleware({ thresholdMs: 30 * 60 * 1000 });   // 30-min threshold
			} catch (err) {
				caught = err;
			}
			expect(caught).to.be.instanceof(MissingTokenError);
		});

		it('exports DEFAULT_FRESHNESS_THRESHOLD_MS = 5 minutes', () => {
			expect(DEFAULT_FRESHNESS_THRESHOLD_MS).to.equal(5 * 60 * 1000);
		});

		describe('relogin flag', () => {
			let loginStub;

			beforeEach(() => {
				const CloudCommands = require('../cmd/cloud');
				loginStub = sandbox.stub(CloudCommands.prototype, 'login').resolves();
			});

			it('runs CloudCommands.login() instead of throwing when token is near expiry', async () => {
				settings.access_token_expires_at = inFuture(60 * 1000);   // 1 minute out
				await verifyFreshTokenMiddleware({ relogin: true });   // default 5-min threshold
				expect(loginStub).to.have.property('callCount', 1);
			});

			it('runs CloudCommands.login() when no token is configured', async () => {
				settings.access_token = '';
				await verifyFreshTokenMiddleware({ relogin: true });
				expect(loginStub).to.have.property('callCount', 1);
			});

			it('does not run login when token is fresh', async () => {
				await verifyFreshTokenMiddleware({ relogin: true });   // 1 day out vs 5-min threshold
				expect(loginStub).to.have.property('callCount', 0);
			});

			it('propagates errors thrown by login (e.g. user cancels prompt)', async () => {
				settings.access_token_expires_at = inFuture(60 * 1000);
				loginStub.rejects(new Error('login cancelled'));
				let caught;
				try {
					await verifyFreshTokenMiddleware({ relogin: true });
				} catch (err) {
					caught = err;
				}
				expect(caught).to.have.property('message', 'login cancelled');
			});

			it('throws MissingTokenError when relogin is false and token is near expiry', async () => {
				settings.access_token_expires_at = inFuture(60 * 1000);
				let caught;
				try {
					await verifyFreshTokenMiddleware({ relogin: false });
				} catch (err) {
					caught = err;
				}
				expect(caught).to.be.instanceof(MissingTokenError);
				expect(loginStub).to.have.property('callCount', 0);
			});
		});

		describe('when access_token_expires_at is missing', () => {
			beforeEach(() => {
				settings.access_token_expires_at = undefined;
			});

			it('fetches expiry from the server, persists it, and resolves when fresh', async () => {
				getCurrentAccessTokenStub.resolves({ expires_at: inFuture(60 * 60 * 1000) });
				await verifyFreshTokenMiddleware();
				expect(getCurrentAccessTokenStub).to.have.property('callCount', 1);
				const persisted = overrideStub.getCalls().find(c => c.args[1] === 'access_token_expires_at');
				expect(persisted).to.exist;
				expect(persisted.args[2]).to.be.a('string');
			});

			it('clears local state and throws MissingTokenError when server responds with AuthenticationError', async () => {
				getCurrentAccessTokenStub.rejects(new InvalidTokenError('revoked'));
				let caught;
				try {
					await verifyFreshTokenMiddleware();
				} catch (err) {
					caught = err;
				}
				expect(caught).to.be.instanceof(MissingTokenError);
				expect(overrideStub).to.have.been.calledWith(null, 'access_token', null);
				expect(overrideStub).to.have.been.calledWith(null, 'access_token_expires_at', null);
			});

			it('resolves silently when the server call fails with a non-auth error (network)', async () => {
				getCurrentAccessTokenStub.rejects(new Error('ECONNREFUSED'));
				await verifyFreshTokenMiddleware();   // should not throw
				// And should not clear local state
				const cleared = overrideStub.getCalls().some(c =>
					c.args[1] === 'access_token' && c.args[2] === null
				);
				expect(cleared).to.equal(false);
			});

			it('after persisting fresh expiry, the freshness re-check honors thresholdMs', async () => {
				// Server returns an expiry that's only 1 minute out — should trip the threshold.
				getCurrentAccessTokenStub.resolves({ expires_at: inFuture(60 * 1000) });
				let caught;
				try {
					await verifyFreshTokenMiddleware();   // default 5-min threshold
				} catch (err) {
					caught = err;
				}
				expect(caught).to.be.instanceof(MissingTokenError);
				expect(overrideStub).to.have.been.calledWith(null, 'access_token', null);
			});
		});
	});
});
