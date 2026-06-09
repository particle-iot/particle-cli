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

		it('routes 401 through _checkToken and produces InvalidTokenError', async () => {
			const apiError = new Error('API Error');
			apiError.statusCode = 401;
			apiError.body = { error_description: 'Invalid token' };
			sandbox.stub(particleApi.api, 'getDevice').rejects(apiError);

			try {
				await particleApi.getDevice({ deviceId: 'abc' });
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.name).to.equal('InvalidTokenError');
				expect(error.message).to.equal('Invalid token');
			}
		});

		it('forwards the configured accessToken as `auth`', async () => {
			const stub = sandbox.stub(particleApi.api, 'getDevice').resolves({ body: {} });

			await particleApi.getDevice({ deviceId: 'abc' });

			expect(stub).to.have.been.calledWithMatch({ deviceId: 'abc', auth: 'test-token' });
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

		it('routes MFA rejection through _wrap and produces MfaRequiredError', async () => {
			const mfaError = Object.assign(new Error('HTTP error 403'), {
				statusCode: 403,
				body: { error: 'mfa_required', mfa_token: 'mfa-xyz' }
			});
			sandbox.stub(particleApi.api, 'login').rejects(mfaError);

			try {
				await particleApi.createAccessToken({ username: 'u', password: 'p' });
				expect.fail('should have rejected');
			} catch (err) {
				expect(err.name).to.equal('MfaRequiredError');
				expect(err.mfaToken).to.equal('mfa-xyz');
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

		it('routes a wrong-OTP rejection through _wrap and surfaces the server description', async () => {
			const otpError = Object.assign(new Error('HTTP error 400'), {
				statusCode: 400,
				body: { error: 'invalid_grant', error_description: 'OTP expired' }
			});
			sandbox.stub(particleApi.api, 'sendOtp').rejects(otpError);

			try {
				await particleApi.sendOtp({ mfaToken: 'm', otp: 'wrong' });
				expect.fail('should have rejected');
			} catch (err) {
				expect(err.message).to.equal('OTP expired');
				expect(err.name).to.equal('Error');
			}
		});

		it('extracts a `body.errors` array (claim endpoint) into the message', async () => {
			const claimError = Object.assign(new Error('HTTP error 403 from https://api.particle.io/v1/devices'), {
				statusCode: 403,
				errorDescription: 'HTTP error 403 from https://api.particle.io/v1/devices',
				body: { errors: ['That belongs to someone else.'] }
			});
			sandbox.stub(particleApi.api, 'claimDevice').rejects(claimError);

			try {
				await particleApi.claimDevice({ deviceId: 'abc' });
				expect.fail('should have rejected');
			} catch (err) {
				expect(err.message).to.equal('That belongs to someone else.');
			}
		});
	});

	// A webhook is a Webhook-type integration, so the wrappers delegate to
	// particle-api-js's generic, org/product-scoped integration methods.
	describe('createWebhookWithObj', () => {
		it('creates a Webhook-type integration carrying the freeform object and auth', async () => {
			const hookObj = { event: 'foo', url: 'https://x', product_ids: [1, 2] };
			const responseBody = { id: 'hook-1' };
			const stub = sandbox.stub(particleApi.api, 'createIntegration').resolves({ body: responseBody });

			const result = await particleApi.createWebhookWithObj(hookObj);

			expect(stub).to.have.been.calledWithMatch({
				event: 'foo',
				settings: Object.assign({ integration_type: 'Webhook' }, hookObj),
				auth: 'test-token'
			});
			expect(result).to.deep.equal(responseBody);
		});

		it('forwards a product scope', async () => {
			const stub = sandbox.stub(particleApi.api, 'createIntegration').resolves({ body: {} });

			await particleApi.createWebhookWithObj({ event: 'foo' }, { product: 'my-product' });

			expect(stub).to.have.been.calledWithMatch({ product: 'my-product' });
		});

		it('forwards an org scope', async () => {
			const stub = sandbox.stub(particleApi.api, 'createIntegration').resolves({ body: {} });

			await particleApi.createWebhookWithObj({ event: 'foo' }, { org: 'my-org' });

			expect(stub).to.have.been.calledWithMatch({ org: 'my-org' });
		});

		it('routes 401 through _checkToken', async () => {
			const apiError = new Error('API Error');
			apiError.statusCode = 401;
			apiError.body = { error_description: 'Invalid token' };
			sandbox.stub(particleApi.api, 'createIntegration').rejects(apiError);

			try {
				await particleApi.createWebhookWithObj({});
				expect.fail('should have thrown');
			} catch (error) {
				expect(error.name).to.equal('InvalidTokenError');
			}
		});
	});

	describe('deleteWebhook', () => {
		it('deletes the integration by id and returns the unwrapped body', async () => {
			const responseBody = { ok: true };
			const stub = sandbox.stub(particleApi.api, 'deleteIntegration').resolves({ body: responseBody });

			const result = await particleApi.deleteWebhook({ hookId: 'hook-42' });

			expect(stub).to.have.been.calledWithMatch({
				integrationId: 'hook-42',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(responseBody);
		});

		it('forwards a product scope', async () => {
			const stub = sandbox.stub(particleApi.api, 'deleteIntegration').resolves({ body: {} });

			await particleApi.deleteWebhook({ hookId: 'hook-42', product: 'my-product' });

			expect(stub).to.have.been.calledWithMatch({ integrationId: 'hook-42', product: 'my-product' });
		});

		it('forwards an org scope', async () => {
			const stub = sandbox.stub(particleApi.api, 'deleteIntegration').resolves({ body: {} });

			await particleApi.deleteWebhook({ hookId: 'hook-42', org: 'my-org' });

			expect(stub).to.have.been.calledWithMatch({ integrationId: 'hook-42', org: 'my-org' });
		});
	});

	describe('listWebhooks', () => {
		it('lists integrations and returns only Webhook-type ones', async () => {
			const integrations = [
				{ id: 'h1', integration_type: 'Webhook' },
				{ id: 'g1', integration_type: 'GoogleCloudPubSub' },
				{ id: 'h2' } // untyped — excluded
			];
			const stub = sandbox.stub(particleApi.api, 'listIntegrations').resolves({ body: integrations });

			const result = await particleApi.listWebhooks();

			expect(stub).to.have.been.calledWithMatch({ auth: 'test-token' });
			expect(result).to.deep.equal([{ id: 'h1', integration_type: 'Webhook' }]);
		});

		it('forwards a product scope', async () => {
			const stub = sandbox.stub(particleApi.api, 'listIntegrations').resolves({ body: [] });

			await particleApi.listWebhooks({ product: 'my-product' });

			expect(stub).to.have.been.calledWithMatch({ product: 'my-product' });
		});

		it('forwards an org scope', async () => {
			const stub = sandbox.stub(particleApi.api, 'listIntegrations').resolves({ body: [] });

			await particleApi.listWebhooks({ org: 'my-org' });

			expect(stub).to.have.been.calledWithMatch({ org: 'my-org' });
		});

		it('normalizes an { integrations: [...] } response envelope', async () => {
			sandbox.stub(particleApi.api, 'listIntegrations').resolves({
				body: { integrations: [{ id: 'h1', integration_type: 'Webhook' }] }
			});

			const result = await particleApi.listWebhooks();

			expect(result).to.deep.equal([{ id: 'h1', integration_type: 'Webhook' }]);
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
				expect(error.name).to.equal('InvalidTokenError');
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
				// 400 is a request-validation error, not an auth error — should pass through unchanged.
				expect(error.name).to.equal('Error');
				expect(error.statusCode).to.equal(400);
				expect(error.body.error_description).to.equal('Invalid operation');
			}
		});
	});
});
