'use strict';

const { expect } = require('../../../test/setup');
const { workflows } = require('./workflow');
const steps = require('./steps');

const nameOf = (fn) => Object.keys(steps).find((k) => steps[k] === fn) || fn.name;
const stepNames = (wf) => wf.steps.map(nameOf);

describe('tachyon workflows', () => {
	const byValue = (v) => workflows[v];

	it('runs the same steps on ubuntu24 as on ubuntu20', () => {
		// ubuntu24 shipped without getCountryStep and getESIMProfilesStep, so setup
		// never fetched the eSIM profiles and the config blob went out with no `esim`
		// key -- while particle-linux's bootstrap has always read one. Keep the two
		// lists identical so that cannot silently drift again.
		expect(stepNames(byValue('ubuntu24'))).to.deep.equal(stepNames(byValue('ubuntu20')));
	});

	for (const value of ['ubuntu20', 'ubuntu24']) {
		it(`asks for a country before fetching eSIM profiles on ${value}`, () => {
			const names = stepNames(byValue(value));
			expect(names).to.include('getCountryStep');
			expect(names).to.include('getESIMProfilesStep');
			// getESIMProfilesStep passes `country` to the API, so the country has to be
			// resolved first or the profile lookup is made for the wrong region.
			expect(names.indexOf('getCountryStep'))
				.to.be.lessThan(names.indexOf('getESIMProfilesStep'));
		});

		it(`builds the config blob after the eSIM profiles are known on ${value}`, () => {
			const names = stepNames(byValue(value));
			// The blob is a snapshot of the context, so anything it must carry has to
			// have run already.
			expect(names.indexOf('getESIMProfilesStep'))
				.to.be.lessThan(names.indexOf('createConfigBlobStep'));
		});
	}

	it('promises modem activation only where setup actually provisions the eSIM', () => {
		// The completion message tells the user the device will "activate the built-in
		// 5G modem". That is only true if setup fetched the eSIM profiles into the
		// config blob, so tie the claim to the step rather than letting the copy drift
		// away from what the workflow does -- 24.04 promised the cloud but not the
		// modem for exactly as long as it was missing getESIMProfilesStep.
		for (const value of ['ubuntu20', 'ubuntu24']) {
			const wf = byValue(value);
			const provisions = stepNames(wf).includes('getESIMProfilesStep');
			for (const variant of wf.variants) {
				const claims = /5G modem/.test(variant.setupCompletedMessage);
				expect(claims, `${value}/${variant.value} modem claim`).to.equal(provisions);
			}
		}
	});

	it('offers a headless variant with a completion message on every ubuntu workflow', () => {
		for (const value of ['ubuntu20', 'ubuntu24']) {
			const headless = byValue(value).variants.find((v) => v.value === 'headless');
			expect(headless, `${value} headless variant`).to.exist;
			expect(headless.setupCompletedMessage, `${value} headless message`).to.be.a('string');
		}
	});
});
