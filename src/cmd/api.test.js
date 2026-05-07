'use strict';
const { expect } = require('../../test/setup');
const sinon = require('sinon');
const ParticleApi = require('./api');

describe('ParticleApi', () => {
	let particleApi;
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		particleApi = new ParticleApi('test-base-url', { accessToken: 'test-token' });
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('getDevice', () => {
		it('routes through _wrap and unwraps the body', async () => {
			const expectedDevice = { id: 'abc', name: 'thing', product_id: 12345 };
			sandbox.stub(particleApi.api, 'getDevice').resolves({ body: expectedDevice, statusCode: 200 });

			const result = await particleApi.getDevice({ deviceId: 'abc' });

			expect(result).to.deep.equal(expectedDevice);
		});

		it('routes 401 through _checkToken and produces UnauthorizedError', async () => {
			const apiError = new Error('API Error');
			apiError.statusCode = 401;
			apiError.body = { error_description: 'Invalid token' };
			sandbox.stub(particleApi.api, 'getDevice').rejects(apiError);

			try {
				await particleApi.getDevice({ deviceId: 'abc' });
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.name).to.equal('UnauthorizedError');
				expect(error.message).to.equal('Invalid token');
			}
		});

		it('forwards the configured accessToken as `auth`', async () => {
			const stub = sandbox.stub(particleApi.api, 'getDevice').resolves({ body: {} });

			await particleApi.getDevice({ deviceId: 'abc' });

			expect(stub).to.have.been.calledWithMatch({ deviceId: 'abc', auth: 'test-token' });
		});
	});

	describe('setAccessToken', () => {
		it('updates this.accessToken', () => {
			particleApi.setAccessToken('rotated');
			expect(particleApi.accessToken).to.equal('rotated');
		});

		it('subsequent calls use the new token', async () => {
			const stub = sandbox.stub(particleApi.api, 'getDevice').resolves({ body: {} });

			particleApi.setAccessToken('rotated');
			await particleApi.getDevice({ deviceId: 'abc' });

			expect(stub).to.have.been.calledWithMatch({ auth: 'rotated' });
		});
	});

	describe('createAccessToken', () => {
		it('returns the body and forwards expiresIn as tokenDuration', async () => {
			const tokenBody = { access_token: 'new-token', expires_in: 3600 };
			const stub = sandbox.stub(particleApi.api, 'login').resolves({ body: tokenBody });

			const result = await particleApi.createAccessToken({
				username: 'u', password: 'p', expiresIn: 3600
			});

			expect(stub).to.have.been.calledWithMatch({ username: 'u', password: 'p', tokenDuration: 3600 });
			expect(result).to.deep.equal(tokenBody);
		});

		it('preserves the MFA rejection envelope (does not route through _wrap)', async () => {
			const mfaError = { error: 'mfa_required', mfa_token: 'mfa-xyz' };
			sandbox.stub(particleApi.api, 'login').rejects(mfaError);

			try {
				await particleApi.createAccessToken({ username: 'u', password: 'p' });
				expect.fail('should have rejected');
			} catch (err) {
				expect(err.error).to.equal('mfa_required');
				expect(err.mfa_token).to.equal('mfa-xyz');
				expect(err.name).to.not.equal('UnauthorizedError');
			}
		});
	});

	describe('sendOtp', () => {
		it('returns the body and forwards mfaToken + otp', async () => {
			const tokenBody = { access_token: 'final-token' };
			const stub = sandbox.stub(particleApi.api, 'sendOtp').resolves({ body: tokenBody });

			const result = await particleApi.sendOtp({ mfaToken: 'mfa-abc', otp: '123456' });

			expect(stub).to.have.been.calledWithMatch({ mfaToken: 'mfa-abc', otp: '123456' });
			expect(result).to.deep.equal(tokenBody);
		});

		it('preserves error envelope (does not route through _wrap)', async () => {
			const otpError = { error: 'invalid_grant', error_description: 'OTP expired' };
			sandbox.stub(particleApi.api, 'sendOtp').rejects(otpError);

			try {
				await particleApi.sendOtp({ mfaToken: 'm', otp: 'wrong' });
				expect.fail('should have rejected');
			} catch (err) {
				expect(err.error_description).to.equal('OTP expired');
				expect(err.name).to.not.equal('UnauthorizedError');
			}
		});
	});

	describe('createWebhookWithObj', () => {
		it('POSTs to /v1/webhooks with the freeform object body and auth', async () => {
			const hookObj = { event: 'foo', url: 'https://x', deviceID: 'abc' };
			const responseBody = { ok: true, id: 'hook-1' };
			const stub = sandbox.stub(particleApi.api, 'request').resolves({ body: responseBody });

			const result = await particleApi.createWebhookWithObj(hookObj);

			expect(stub).to.have.been.calledWithMatch({
				uri: '/v1/webhooks',
				method: 'post',
				auth: 'test-token',
				data: hookObj
			});
			expect(result).to.deep.equal(responseBody);
		});

		it('routes 401 through _checkToken', async () => {
			const apiError = new Error('API Error');
			apiError.statusCode = 401;
			apiError.body = { error_description: 'Invalid token' };
			sandbox.stub(particleApi.api, 'request').rejects(apiError);

			try {
				await particleApi.createWebhookWithObj({});
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.name).to.equal('UnauthorizedError');
			}
		});
	});

	describe('deleteWebhook', () => {
		it('forwards hookId and auth, returns the unwrapped body', async () => {
			const responseBody = { ok: true };
			const stub = sandbox.stub(particleApi.api, 'deleteWebhook').resolves({ body: responseBody });

			const result = await particleApi.deleteWebhook({ hookId: 'hook-42' });

			expect(stub).to.have.been.calledWithMatch({ hookId: 'hook-42', auth: 'test-token' });
			expect(result).to.deep.equal(responseBody);
		});
	});

	describe('listWebhooks', () => {
		it('forwards auth, returns the unwrapped body', async () => {
			const hooks = [{ id: 'h1' }, { id: 'h2' }];
			const stub = sandbox.stub(particleApi.api, 'listWebhooks').resolves({ body: hooks });

			const result = await particleApi.listWebhooks();

			expect(stub).to.have.been.calledWithMatch({ auth: 'test-token' });
			expect(result).to.deep.equal(hooks);
		});
	});

	describe('listEnv', () => {
		it('should call the correct API endpoint for sandbox', async () => {
			const expectedUri = '/v1/env';
			const expectedResponse = { body: { env: { own: { FOO: { value: 'bar' } } } } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.listEnv({ sandbox: true });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'get',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for org', async () => {
			const org = 'testOrg';
			const expectedUri = `/v1/orgs/${org}/env`;
			const expectedResponse = { body: { env: { own: { FOO: { value: 'bar' } } } } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.listEnv({ org });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'get',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for product', async () => {
			const productId = 'testProductId';
			const expectedUri = `/v1/products/${productId}/env`;
			const expectedResponse = { body: { env: { own: { FOO: { value: 'bar' } } } } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.listEnv({ productId });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'get',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for device', async () => {
			const deviceId = 'testDeviceId';
			const expectedUri = `/v1/env/${deviceId}`;
			const expectedResponse = { body: { env: { own: { FOO: { value: 'bar' } } } } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.listEnv({ deviceId });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'get',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should handle API errors', async () => {
			const expectedError = new Error('API Error');
			expectedError.statusCode = 401;
			expectedError.body = { error_description: 'Unauthorized' };

			sandbox.stub(particleApi.api, 'request').rejects(expectedError);

			try {
				await particleApi.listEnv({ sandbox: true });
				expect.fail('should have thrown an error');
			} catch (error) {
				expect(error.message).to.equal('Unauthorized');
				expect(error.name).to.equal('UnauthorizedError');
			}
		});
	});

	describe('patchEnv', () => {
		const operations = [{ op: 'Set', key: 'FOO', value: 'bar' }];

		it('should call the correct API endpoint for sandbox', async () => {
			const expectedUri = '/v1/env';
			const expectedResponse = { body: { success: true } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.patchEnv({ sandbox: true, operations });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'patch',
				auth: 'test-token',
				data: { ops: operations }
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for org', async () => {
			const org = 'testOrg';
			const expectedUri = `/v1/orgs/${org}/env`;
			const expectedResponse = { body: { success: true } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.patchEnv({ org, operations });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'patch',
				auth: 'test-token',
				data: { ops: operations }
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for product', async () => {
			const productId = 'testProductId';
			const expectedUri = `/v1/products/${productId}/env`;
			const expectedResponse = { body: { success: true } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.patchEnv({ productId, operations });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'patch',
				auth: 'test-token',
				data: { ops: operations }
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for device', async () => {
			const deviceId = 'testDeviceId';
			const expectedUri = `/v1/env/${deviceId}`;
			const expectedResponse = { body: { success: true } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.patchEnv({ deviceId, operations });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'patch',
				auth: 'test-token',
				data: { ops: operations }
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should handle set operation', async () => {
			const setOperations = [{ op: 'Set', key: 'NEW_VAR', value: 'new_value' }];
			const expectedResponse = { body: { success: true } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			await particleApi.patchEnv({ sandbox: true, operations: setOperations });

			expect(requestStub).to.have.been.calledWithMatch({
				data: { ops: setOperations }
			});
		});

		it('should handle unset operation', async () => {
			const unsetOperations = [{ op: 'Unset', key: 'OLD_VAR' }];
			const expectedResponse = { body: { success: true } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			await particleApi.patchEnv({ sandbox: true, operations: unsetOperations });

			expect(requestStub).to.have.been.calledWithMatch({
				data: { ops: unsetOperations }
			});
		});

		it('should handle multiple operations', async () => {
			const multipleOperations = [
				{ op: 'Set', key: 'VAR1', value: 'value1' },
				{ op: 'Set', key: 'VAR2', value: 'value2' },
				{ op: 'Unset', key: 'VAR3' }
			];
			const expectedResponse = { body: { success: true } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			await particleApi.patchEnv({ sandbox: true, operations: multipleOperations });

			expect(requestStub).to.have.been.calledWithMatch({
				data: { ops: multipleOperations }
			});
		});

		it('should handle API errors', async () => {
			const expectedError = new Error('API Error');
			expectedError.statusCode = 400;
			expectedError.body = { error_description: 'Invalid operation' };

			sandbox.stub(particleApi.api, 'request').rejects(expectedError);

			try {
				await particleApi.patchEnv({ sandbox: true, operations });
				expect.fail('should have thrown an error');
			} catch (error) {
				expect(error.message).to.equal('Invalid operation');
				expect(error.name).to.equal('UnauthorizedError');
			}
		});
	});
});
