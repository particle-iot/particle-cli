'use strict';

const { expect, sinon } = require('../../test/setup');
const proxyquire = require('proxyquire').noCallThru();

describe('auth-helper', () => {
	let authHelper;
	let mockSettings;
	let mockLog;
	let mockCloudCommand;
	let loginStub;

	beforeEach(() => {
		loginStub = sinon.stub().resolves();
		mockCloudCommand = function() {};
		mockCloudCommand.prototype.login = loginStub;

		mockSettings = {
			access_token: 'test-token',
			autoReauth: true
		};

		mockLog = {
			verbose: sinon.stub(),
			warn: sinon.stub(),
			error: sinon.stub()
		};

		authHelper = proxyquire('./auth-helper', {
			'../../settings': mockSettings,
			'./log': mockLog,
			'../cmd/cloud': mockCloudCommand
		});
	});

	describe('AUTH_MESSAGES', () => {
		it('should have all required message templates', () => {
			expect(authHelper.AUTH_MESSAGES).to.have.property('REQUIRED_LOGIN');
			expect(authHelper.AUTH_MESSAGES).to.have.property('TOKEN_EXPIRED');
			expect(authHelper.AUTH_MESSAGES).to.have.property('TOKEN_INVALID');
			expect(authHelper.AUTH_MESSAGES).to.have.property('NON_INTERACTIVE_EXPIRED');
			expect(authHelper.AUTH_MESSAGES).to.have.property('NON_INTERACTIVE_MISSING');
			expect(authHelper.AUTH_MESSAGES).to.have.property('AUTO_REAUTH_DISABLED');
			expect(authHelper.AUTH_MESSAGES).to.have.property('CACHE_STALE');
		});
	});

	describe('CACHE_STALE_THRESHOLD', () => {
		it('should be 1 week in milliseconds', () => {
			expect(authHelper.CACHE_STALE_THRESHOLD).to.equal(604800000);
		});
	});

	describe('isInteractive', () => {
		let originalStdinTTY;
		let originalStdoutTTY;

		beforeEach(() => {
			originalStdinTTY = process.stdin.isTTY;
			originalStdoutTTY = process.stdout.isTTY;
		});

		afterEach(() => {
			process.stdin.isTTY = originalStdinTTY;
			process.stdout.isTTY = originalStdoutTTY;
		});

		it('should return true when both stdin and stdout are TTY', () => {
			process.stdin.isTTY = true;
			process.stdout.isTTY = true;
			expect(authHelper.isInteractive()).to.be.true;
		});

		it('should return false when stdin is not TTY', () => {
			process.stdin.isTTY = false;
			process.stdout.isTTY = true;
			expect(authHelper.isInteractive()).to.be.false;
		});

		it('should return false when stdout is not TTY', () => {
			process.stdin.isTTY = true;
			process.stdout.isTTY = false;
			expect(authHelper.isInteractive()).to.be.false;
		});

		it('should return false when both are not TTY', () => {
			process.stdin.isTTY = false;
			process.stdout.isTTY = false;
			expect(authHelper.isInteractive()).to.be.false;
		});
	});

	describe('isAutoReauthEnabled', () => {
		it('should return true by default', () => {
			mockSettings.autoReauth = undefined;
			expect(authHelper.isAutoReauthEnabled()).to.be.true;
		});

		it('should return true when explicitly enabled', () => {
			mockSettings.autoReauth = true;
			expect(authHelper.isAutoReauthEnabled()).to.be.true;
		});

		it('should return false when explicitly disabled', () => {
			mockSettings.autoReauth = false;
			expect(authHelper.isAutoReauthEnabled()).to.be.false;
		});
	});

	describe('hasValidToken', () => {
		it('should return true when access_token exists', () => {
			mockSettings.access_token = 'valid-token';
			expect(authHelper.hasValidToken()).to.be.true;
		});

		it('should return false when access_token is null', () => {
			mockSettings.access_token = null;
			expect(authHelper.hasValidToken()).to.be.false;
		});

		it('should return false when access_token is undefined', () => {
			mockSettings.access_token = undefined;
			expect(authHelper.hasValidToken()).to.be.false;
		});

		it('should return false when access_token is empty string', () => {
			mockSettings.access_token = '';
			expect(authHelper.hasValidToken()).to.be.false;
		});
	});

	describe('isAuthError', () => {
		it('should return true for UnauthorizedError', () => {
			const error = new Error('test');
			error.name = 'UnauthorizedError';
			expect(authHelper.isAuthError(error)).to.be.true;
		});

		it('should return true for errors with isAuthError flag', () => {
			const error = new Error('test');
			error.isAuthError = true;
			expect(authHelper.isAuthError(error)).to.be.true;
		});

		it('should return true for 401 status code', () => {
			const error = new Error('test');
			error.statusCode = 401;
			expect(authHelper.isAuthError(error)).to.be.true;
		});

		it('should return true for 400 status code', () => {
			const error = new Error('test');
			error.statusCode = 400;
			expect(authHelper.isAuthError(error)).to.be.true;
		});

		it('should return true for 403 status code', () => {
			const error = new Error('test');
			error.statusCode = 403;
			expect(authHelper.isAuthError(error)).to.be.true;
		});

		it('should return true for "invalid access token" message', () => {
			const error = new Error('Invalid access token');
			expect(authHelper.isAuthError(error)).to.be.true;
		});

		it('should return true for "unauthorized" message', () => {
			const error = new Error('Unauthorized');
			expect(authHelper.isAuthError(error)).to.be.true;
		});

		it('should return true for "token expired" message', () => {
			const error = new Error('Token expired');
			expect(authHelper.isAuthError(error)).to.be.true;
		});

		it('should return false for other errors', () => {
			const error = new Error('Some other error');
			expect(authHelper.isAuthError(error)).to.be.false;
		});

		it('should return false for null', () => {
			expect(authHelper.isAuthError(null)).to.be.false;
		});

		it('should return false for undefined', () => {
			expect(authHelper.isAuthError(undefined)).to.be.false;
		});
	});

	describe('isConnectivityError', () => {
		it('should return true for ECONNREFUSED', () => {
			const error = new Error('connect ECONNREFUSED');
			expect(authHelper.isConnectivityError(error)).to.be.true;
		});

		it('should return true for ENOTFOUND', () => {
			const error = new Error('getaddrinfo ENOTFOUND');
			expect(authHelper.isConnectivityError(error)).to.be.true;
		});

		it('should return true for ETIMEDOUT', () => {
			const error = new Error('connect ETIMEDOUT');
			expect(authHelper.isConnectivityError(error)).to.be.true;
		});

		it('should return true for network error', () => {
			const error = new Error('Network error');
			expect(authHelper.isConnectivityError(error)).to.be.true;
		});

		it('should return true for ECONNRESET', () => {
			const error = new Error('socket hang up ECONNRESET');
			expect(authHelper.isConnectivityError(error)).to.be.true;
		});

		it('should return false for auth errors', () => {
			const error = new Error('Invalid access token');
			expect(authHelper.isConnectivityError(error)).to.be.false;
		});

		it('should return false for other errors', () => {
			const error = new Error('Some error');
			expect(authHelper.isConnectivityError(error)).to.be.false;
		});

		it('should return false for null', () => {
			expect(authHelper.isConnectivityError(null)).to.be.false;
		});
	});

	describe('getAuthErrorReason', () => {
		it('should return MISSING when no error', () => {
			expect(authHelper.getAuthErrorReason(null)).to.equal(authHelper.AUTH_ERROR_REASONS.MISSING);
		});

		it('should return EXPIRED for expired token message', () => {
			const error = new Error('Token expired');
			expect(authHelper.getAuthErrorReason(error)).to.equal(authHelper.AUTH_ERROR_REASONS.EXPIRED);
		});

		it('should return INVALID for invalid token message', () => {
			const error = new Error('Invalid token');
			expect(authHelper.getAuthErrorReason(error)).to.equal(authHelper.AUTH_ERROR_REASONS.INVALID);
		});

		it('should return INVALID for unauthorized message', () => {
			const error = new Error('Unauthorized');
			expect(authHelper.getAuthErrorReason(error)).to.equal(authHelper.AUTH_ERROR_REASONS.INVALID);
		});

		it('should return MISSING when no token in settings', () => {
			mockSettings.access_token = null;
			const error = new Error('Some error');
			expect(authHelper.getAuthErrorReason(error)).to.equal(authHelper.AUTH_ERROR_REASONS.MISSING);
		});
	});

	describe('formatCacheAge', () => {
		it('should format seconds', () => {
			expect(authHelper.formatCacheAge(5000)).to.equal('5 seconds');
			expect(authHelper.formatCacheAge(1000)).to.equal('1 second');
		});

		it('should format minutes', () => {
			expect(authHelper.formatCacheAge(60000)).to.equal('1 minute');
			expect(authHelper.formatCacheAge(120000)).to.equal('2 minutes');
		});

		it('should format hours', () => {
			expect(authHelper.formatCacheAge(3600000)).to.equal('1 hour');
			expect(authHelper.formatCacheAge(7200000)).to.equal('2 hours');
		});

		it('should format days', () => {
			expect(authHelper.formatCacheAge(86400000)).to.equal('1 day');
			expect(authHelper.formatCacheAge(172800000)).to.equal('2 days');
		});

		it('should format weeks', () => {
			expect(authHelper.formatCacheAge(604800000)).to.equal('1 week');
			expect(authHelper.formatCacheAge(1209600000)).to.equal('2 weeks');
		});
	});

	describe('isCacheStale', () => {
		it('should return false for cache less than 1 week old', () => {
			expect(authHelper.isCacheStale(604800000 - 1)).to.be.false;
		});

		it('should return true for cache exactly 1 week old', () => {
			expect(authHelper.isCacheStale(604800001)).to.be.true;
		});

		it('should return true for cache more than 1 week old', () => {
			expect(authHelper.isCacheStale(1000000000)).to.be.true;
		});
	});

	describe('logCacheStalenessWarning', () => {
		it('should log warning for stale cache', () => {
			authHelper.logCacheStalenessWarning({ ageMs: 700000000 });
			expect(mockLog.warn).to.have.been.calledOnce;
		});

		it('should not log warning for fresh cache', () => {
			authHelper.logCacheStalenessWarning({ ageMs: 1000 });
			expect(mockLog.warn).to.not.have.been.called;
		});

		it('should include context in warning message', () => {
			authHelper.logCacheStalenessWarning({ ageMs: 700000000, context: 'device info' });
			expect(mockLog.warn).to.have.been.calledOnce;
			const callArgs = mockLog.warn.firstCall.args[0];
			expect(callArgs).to.include('device info');
		});
	});

	describe('ensureAuth', () => {
		it('should return true when token exists', async () => {
			mockSettings.access_token = 'valid-token';
			const result = await authHelper.ensureAuth();
			expect(result).to.be.true;
		});

		it('should return false when optional and no token', async () => {
			mockSettings.access_token = null;
			const result = await authHelper.ensureAuth({ required: false });
			expect(result).to.be.false;
		});

		it('should throw when required and no token (non-interactive)', async () => {
			mockSettings.access_token = null;
			let error;
			try {
				await authHelper.ensureAuth({ required: true, interactive: false });
			} catch (e) {
				error = e;
			}
			expect(error).to.exist;
			expect(error.message).to.include('login');
		});

		it('should attempt login when required, no token, and interactive', async () => {
			mockSettings.access_token = null;
			loginStub.callsFake(() => {
				mockSettings.access_token = 'new-token';
				return Promise.resolve();
			});

			const result = await authHelper.ensureAuth({ required: true, interactive: true });
			expect(loginStub).to.have.been.calledOnce;
			expect(result).to.be.true;
		});

		it('should throw when auto-reauth is disabled (non-interactive msg)', async () => {
			mockSettings.access_token = null;
			mockSettings.autoReauth = false;
			let error;
			try {
				await authHelper.ensureAuth({ required: true, interactive: true });
			} catch (e) {
				error = e;
			}
			expect(error).to.exist;
			expect(error.message).to.include('Auto-reauth is disabled');
		});
	});

	describe('tryWithAuth', () => {
		it('should execute function successfully', async () => {
			const fn = sinon.stub().resolves('success');
			const result = await authHelper.tryWithAuth(fn);
			expect(result).to.equal('success');
			expect(fn).to.have.been.calledOnce;
		});

		it('should rethrow non-auth errors', async () => {
			const fn = sinon.stub().rejects(new Error('some other error'));
			let error;
			try {
				await authHelper.tryWithAuth(fn);
			} catch (e) {
				error = e;
			}
			expect(error).to.exist;
			expect(error.message).to.equal('some other error');
		});

		it('should call fallback on connectivity error', async () => {
			const fn = sinon.stub().rejects(new Error('connect ECONNREFUSED'));
			const fallback = sinon.stub().resolves('cached-data');

			const result = await authHelper.tryWithAuth(fn, { fallback });
			expect(result).to.equal('cached-data');
			expect(fallback).to.have.been.calledOnce;
		});

		it('should return undefined on optional auth failure without fallback', async () => {
			const authError = new Error('Invalid access token');
			authError.name = 'UnauthorizedError';
			const fn = sinon.stub().rejects(authError);

			const result = await authHelper.tryWithAuth(fn, { optional: true, interactive: false });
			expect(result).to.be.undefined;
		});

		it('should retry after successful reauth', async () => {
			const authError = new Error('Invalid access token');
			authError.name = 'UnauthorizedError';

			let callCount = 0;
			const fn = sinon.stub().callsFake(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.reject(authError);
				}
				return Promise.resolve('success after reauth');
			});

			loginStub.resolves();
			mockSettings.access_token = 'new-token';

			const result = await authHelper.tryWithAuth(fn, { interactive: true });
			expect(result).to.equal('success after reauth');
			expect(fn).to.have.been.calledTwice;
			expect(loginStub).to.have.been.calledOnce;
		});

		it('should use fallback after failed reauth', async () => {
			const authError = new Error('Invalid access token');
			authError.name = 'UnauthorizedError';
			const fn = sinon.stub().rejects(authError);
			const fallback = sinon.stub().resolves('fallback-data');

			loginStub.rejects(new Error('Login failed'));

			const result = await authHelper.tryWithAuth(fn, {
				interactive: true,
				fallback
			});
			expect(result).to.equal('fallback-data');
		});

		it('should log verbose message on optional auth failure', async () => {
			const authError = new Error('Invalid access token');
			authError.name = 'UnauthorizedError';
			const fn = sinon.stub().rejects(authError);

			await authHelper.tryWithAuth(fn, { optional: true, interactive: false, context: 'device lookup' });
			expect(mockLog.verbose).to.have.been.called;
		});
	});

	describe('createAuthError', () => {
		it('should create error with auth metadata', () => {
			const error = authHelper.createAuthError('Test message', {
				statusCode: 401,
				reason: authHelper.AUTH_ERROR_REASONS.EXPIRED
			});

			expect(error.name).to.equal('UnauthorizedError');
			expect(error.message).to.equal('Test message');
			expect(error.isAuthError).to.be.true;
			expect(error.statusCode).to.equal(401);
			expect(error.reason).to.equal('expired');
		});

		it('should infer reason if not provided', () => {
			const error = authHelper.createAuthError('Token expired');
			expect(error.reason).to.equal('expired');
		});
	});

	describe('getAuthErrorMessage', () => {
		it('should return NON_INTERACTIVE_MISSING for missing token in non-interactive mode', () => {
			const msg = authHelper.getAuthErrorMessage({
				reason: authHelper.AUTH_ERROR_REASONS.MISSING,
				interactive: false,
				autoReauthEnabled: true
			});
			expect(msg).to.include('non-interactive');
		});

		it('should return NON_INTERACTIVE_EXPIRED for expired token in non-interactive mode', () => {
			const msg = authHelper.getAuthErrorMessage({
				reason: authHelper.AUTH_ERROR_REASONS.EXPIRED,
				interactive: false,
				autoReauthEnabled: true
			});
			expect(msg).to.include('non-interactive');
		});

		it('should return AUTO_REAUTH_DISABLED when auto-reauth is off', () => {
			const msg = authHelper.getAuthErrorMessage({
				reason: authHelper.AUTH_ERROR_REASONS.EXPIRED,
				interactive: true,
				autoReauthEnabled: false
			});
			expect(msg).to.include('Auto-reauth is disabled');
		});

		it('should return REQUIRED_LOGIN for missing token in interactive mode', () => {
			const msg = authHelper.getAuthErrorMessage({
				reason: authHelper.AUTH_ERROR_REASONS.MISSING,
				interactive: true,
				autoReauthEnabled: true
			});
			expect(msg).to.include('not logged in');
		});

		it('should return TOKEN_EXPIRED for expired token in interactive mode', () => {
			const msg = authHelper.getAuthErrorMessage({
				reason: authHelper.AUTH_ERROR_REASONS.EXPIRED,
				interactive: true,
				autoReauthEnabled: true
			});
			expect(msg).to.include('expired');
		});
	});
});

