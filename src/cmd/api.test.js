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

	describe('getRollout', () => {
		it('should call the correct API endpoint for product rollout', async () => {
			const productId = 'testProductId';
			const expectedUri = `/v1/products/${productId}/env-vars/rollout`;
			const expectedResponse = { body: { some: 'data' } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.getRollout({ productId });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'get',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for org rollout', async () => {
			const org = 'testOrg';
			const expectedUri = `/v1/orgs/${org}/env-vars/rollout`;
			const expectedResponse = { body: { some: 'other-data' } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.getRollout({ org });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'get',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for sandbox rollout when no org or product is provided', async () => {
			const expectedUri = `/v1/env-vars/rollout`;
			const expectedResponse = { body: { some: 'sandbox-data' } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.getRollout({});

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'get',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should call the correct API endpoint for device rollout', async () => {
			const deviceId = 'testDeviceId';
			const expectedUri = `/v1/env-vars/${deviceId}/rollout`;
			const expectedResponse = { body: { some: 'sandbox-device-data' } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.getRollout({ deviceId });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'get',
				auth: 'test-token'
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('should handle API errors', async () => {
			const productId = 'testProductId';
			const expectedError = new Error('API Error');
			expectedError.statusCode = 401;
			expectedError.body = { error_description: 'Unauthorized' };

			sandbox.stub(particleApi.api, 'request').rejects(expectedError);

			try {
				await particleApi.getRollout({ productId });
				expect.fail('should have thrown an error');
			} catch (error) {
				expect(error.message).to.equal('Unauthorized');
				expect(error.name).to.equal('UnauthorizedError');
			}
		});
	});

	describe('performEnvRollout', () => {
		it('calls the correct API endpoint for product rollout', async () => {
			const productId = 'testProductId';
			const expectedUri = `/v1/products/${productId}/env-vars/rollout`;
			const expectedResponse = { body: { some: 'data' } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.performEnvRollout({ productId });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'post',
				auth: 'test-token',
				data: { when: 'Connect' }
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('calls the correct API endpoint for org rollout', async () => {
			const org = 'testOrg';
			const expectedUri = `/v1/orgs/${org}/env-vars/rollout`;
			const expectedResponse = { body: { some: 'other-data' } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.performEnvRollout({ org });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'post',
				auth: 'test-token',
				data: { when: 'Connect' }
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('calls the correct API endpoint for sandbox rollout when no org or product is provided', async () => {
			const expectedUri = `/v1/env-vars/rollout`;
			const expectedResponse = { body: { some: 'sandbox-data' } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.performEnvRollout({});

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'post',
				auth: 'test-token',
				data: { when: 'Connect' }
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('calls the correct API endpoint for device rollout', async () => {
			const deviceId = 'testDeviceId';
			const expectedUri = `/v1/env-vars/${deviceId}/rollout`;
			const expectedResponse = { body: { some: 'sandbox-device-data' } };

			const requestStub = sandbox.stub(particleApi.api, 'request').resolves(expectedResponse);

			const result = await particleApi.performEnvRollout({ deviceId, when: 'Immediate' });

			expect(requestStub).to.have.been.calledWithMatch({
				uri: expectedUri,
				method: 'post',
				auth: 'test-token',
				data: { when: 'Immediate' }
			});
			expect(result).to.deep.equal(expectedResponse.body);
		});

		it('handles API errors', async () => {
			const productId = 'testProductId';
			const expectedError = new Error('API Error');
			expectedError.statusCode = 401;
			expectedError.body = { error_description: 'Unauthorized' };

			sandbox.stub(particleApi.api, 'request').rejects(expectedError);

			try {
				await particleApi.performEnvRollout({ productId });
				expect.fail('should have thrown an error');
			} catch (error) {
				expect(error.message).to.equal('Unauthorized');
				expect(error.name).to.equal('UnauthorizedError');
			}
		});
	});
});
