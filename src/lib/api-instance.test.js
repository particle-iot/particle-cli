'use strict';
const { expect } = require('../../test/setup');
const sinon = require('sinon');
const apiInstance = require('./api-instance');
const ParticleApi = require('../cmd/api');

describe('api-instance (token-propagation registry)', () => {
	beforeEach(() => {
		apiInstance.__resetForTests();
	});

	afterEach(() => {
		apiInstance.__resetForTests();
	});

	it('register + setTokenOnAll updates a single instance', () => {
		const fake = { setAccessToken: sinon.stub() };
		apiInstance.register(fake);

		apiInstance.setTokenOnAll('new-token');

		expect(fake.setAccessToken).to.have.been.calledOnceWith('new-token');
	});

	it('setTokenOnAll updates every registered instance', () => {
		const a = { setAccessToken: sinon.stub() };
		const b = { setAccessToken: sinon.stub() };
		const c = { setAccessToken: sinon.stub() };
		apiInstance.register(a);
		apiInstance.register(b);
		apiInstance.register(c);

		apiInstance.setTokenOnAll('rotated');

		expect(a.setAccessToken).to.have.been.calledOnceWith('rotated');
		expect(b.setAccessToken).to.have.been.calledOnceWith('rotated');
		expect(c.setAccessToken).to.have.been.calledOnceWith('rotated');
	});

	it('unregister removes an instance from rotation', () => {
		const stays = { setAccessToken: sinon.stub() };
		const leaves = { setAccessToken: sinon.stub() };
		apiInstance.register(stays);
		apiInstance.register(leaves);

		apiInstance.unregister(leaves);
		apiInstance.setTokenOnAll('xyz');

		expect(stays.setAccessToken).to.have.been.calledOnceWith('xyz');
		expect(leaves.setAccessToken).to.not.have.been.called;
	});

	it('setTokenOnAll skips instances missing setAccessToken (defensive)', () => {
		const good = { setAccessToken: sinon.stub() };
		const bad = {};
		apiInstance.register(good);
		apiInstance.register(bad);

		expect(() => apiInstance.setTokenOnAll('safe')).to.not.throw();
		expect(good.setAccessToken).to.have.been.calledOnceWith('safe');
	});

	it('__resetForTests clears the registry', () => {
		const ghost = { setAccessToken: sinon.stub() };
		apiInstance.register(ghost);

		apiInstance.__resetForTests();
		apiInstance.setTokenOnAll('post-reset');

		expect(ghost.setAccessToken).to.not.have.been.called;
	});

	describe('integration with ParticleApi', () => {
		it('ParticleApi auto-registers in its constructor', () => {
			const a = new ParticleApi('test-base-url', { accessToken: 'first' });
			const b = new ParticleApi('test-base-url', { accessToken: 'second' });

			apiInstance.setTokenOnAll('rotated');

			expect(a.accessToken).to.equal('rotated');
			expect(b.accessToken).to.equal('rotated');
		});

		it('setAccessToken on a single instance does not affect others', () => {
			const a = new ParticleApi('test-base-url', { accessToken: 'tok-a' });
			const b = new ParticleApi('test-base-url', { accessToken: 'tok-b' });

			a.setAccessToken('changed');

			expect(a.accessToken).to.equal('changed');
			expect(b.accessToken).to.equal('tok-b');
		});
	});
});
