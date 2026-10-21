'use strict';
const tls = require('tls');
const { expect, sinon } = require('../../test/setup');
const applyTrustStore = require('./trust-store');


describe('Trust Store', () => {
	const sandbox = sinon.createSandbox();
	const bundled = tls.getCACertificates('bundled');
	let fakeTls;

	beforeEach(() => {
		fakeTls = {
			getCACertificates: sandbox.stub().returns(bundled),
			setDefaultCACertificates: sandbox.stub()
		};
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('removes only the listed roots from the bundled store', () => {
		const removed = ['ISRG Root X1', 'Amazon Root CA 1'];

		const result = applyTrustStore({ tls: fakeTls, removed });

		expect(result.sort()).to.eql(removed.sort());
		expect(fakeTls.getCACertificates).to.have.been.calledWith('bundled');
		const kept = fakeTls.setDefaultCACertificates.firstCall.args[0];
		expect(kept).to.have.lengthOf(bundled.length - removed.length);
		expect(kept.every((pem) => bundled.includes(pem))).to.equal(true);
	});

	it('removes the roots dropped from the Node root list by default', () => {
		expect(applyTrustStore.REMOVED_ROOTS).to.eql([
			'emSign ECC Root CA - G3',
			'emSign Root CA - C1',
			'emSign ECC Root CA - C3'
		]);
	});
});
