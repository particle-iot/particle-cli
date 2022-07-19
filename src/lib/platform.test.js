const { PLATFORMS, PlatformId, platformForId, isKnownPlatformId } = require('../../platform');
const { expect } = require('../../test/setup');

const deviceConstants = require('@particle/device-constants');

const supportedPlatforms = Object.values(deviceConstants).filter(p => p.public);

describe('Platform utilities', () => {
	describe('PLATFORMS', () => {
		it('contains description objects for all supported platforms', () => {
			expect(PLATFORMS).to.deep.equal(supportedPlatforms);
		});
	});

	describe('PlatformId', () => {
		it('has an entry for each supported platform', () => {
			for (const p of supportedPlatforms) {
				expect(PlatformId[p.name.toUpperCase()]).to.equal(p.id);
			}
		});
	});

	describe('platformForId()', () => {
		it('returns a platform description for a given platform ID', () => {
			for (const p of supportedPlatforms) {
				const p2 = platformForId(p.id);
				expect(p2).to.deep.equal(p);
			}
		});

		it('throws an error if the argument is not a known platform ID', () => {
			expect(() => platformForId(1000)).to.throw('Unknown platform ID: 1000');
		});
	});

	describe('isKnownPlatformId()', () => {
		it('returns true if the argument is a known platform ID', () => {
			for (const p of supportedPlatforms) {
				expect(isKnownPlatformId(p.id)).to.be.true;
			}
		});

		it('returns false if the argument is not a known platform ID', () => {
			expect(isKnownPlatformId(1000)).to.be.false;
		});
	});
});
