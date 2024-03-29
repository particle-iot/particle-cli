const { expect } = require('../../test/setup');
const { knownAppNames, knownAppsForPlatform } = require('./known-apps');

describe('Known Apps', () => {
	describe('knownAppsNames', () => {
		it('returns all the known apps', () => {
			const apps = knownAppNames();

			expect(apps.sort()).to.eql(['tinker', 'tinker-usb-debugging']);
		});
	});

	describe('knownAppsForPlatform', () => {
		it('returns the known apps for Photon', () => {
			const apps = knownAppsForPlatform('photon');

			expect(Object.keys(apps)).to.eql(['tinker']);
		});
	});
});
