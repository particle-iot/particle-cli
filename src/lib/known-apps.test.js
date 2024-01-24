const { expect } = require('../../test/setup');
const { knownAppNames, knownAppsForPlatform } = require('./known-apps');

describe('Known Apps', () => {
	describe('knownAppsNames', () => {
		it('returns all the known apps', () => {
			const apps = knownAppNames();

			// XXX: Should we remove doctor from knownApps as well?
			expect(apps.sort()).to.eql(['doctor', 'tinker', 'tinker-usb-debugging']);
		});
	});

	describe('knownAppsForPlatform', () => {
		it('returns the known apps for Photon', () => {
			const apps = knownAppsForPlatform('photon');

			expect(Object.keys(apps)).to.eql(['doctor', 'tinker']);
		});
	});
});
