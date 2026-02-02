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
