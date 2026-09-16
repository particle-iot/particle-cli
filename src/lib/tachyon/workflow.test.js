'use strict';

const { expect, sinon } = require('../../../test/setup');
const { workflows } = require('./workflow');
const steps = require('./steps');

const nameOf = (fn) => Object.keys(steps).find((k) => steps[k] === fn) || fn.name;
const stepNames = (wf) => wf.steps.map(nameOf);

describe('tachyon workflows', () => {
	const byValue = (v) => workflows[v];

	it('shares one setup pipeline across all four Linux distributions', () => {
		for (const value of ['ubuntu24', 'ubuntu26', 'qli20']) {
			expect(byValue(value).steps).to.equal(byValue('ubuntu20').steps);
		}
	});

	it('offers only headless on QLI and both variants on each Ubuntu release', () => {
		expect(workflows.qli20.variants.map(v => v.value)).to.eql(['headless']);
		for (const value of ['ubuntu20', 'ubuntu24', 'ubuntu26']) {
			expect(byValue(value).variants.map(v => v.value)).to.eql(['desktop', 'headless']);
		}
	});

	for (const value of ['ubuntu20', 'ubuntu24', 'ubuntu26', 'qli20']) {
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

	it('selects the sole QLI headless variant without a prompt', async () => {
		const ui = { write: sinon.stub(), prompt: sinon.stub() };
		const result = await steps.pickVariant({
			ui, workflow: workflows.qli20, version: 'latest', log: { info: sinon.stub() },
			manifest: [{ variant: 'headless', version: '1.4.2', artifacts: [{ artifact_url: 'image.zip', sha256_checksum: 'checksum' }] }]
		}, 1);
		expect(result).to.eql({ variant: 'headless', buildVersion: '1.4.2', url: 'image.zip', expectedChecksum: 'checksum' });
		expect(ui.prompt).not.to.have.been.called;
	});

	it('rejects an unsupported explicit variant even for local images', async () => {
		await expect(steps.pickVariant({
			workflow: workflows.qli20, variant: 'desktop', isLocalVersion: true
		}, 1)).to.be.rejectedWith("Variant 'desktop' is not supported");
	});

	it('promises modem activation only where setup actually provisions the eSIM', () => {
		// The completion message tells the user the device will "activate the built-in
		// 5G modem". That is only true if setup fetched the eSIM profiles into the
		// config blob, so tie the claim to the step rather than letting the copy drift
		// away from what the workflow does -- 24.04 promised the cloud but not the
		// modem for exactly as long as it was missing getESIMProfilesStep.
		for (const value of ['ubuntu20', 'ubuntu24', 'ubuntu26', 'qli20']) {
			const wf = byValue(value);
			const provisions = stepNames(wf).includes('getESIMProfilesStep');
			for (const variant of wf.variants) {
				const claims = /5G modem/.test(variant.setupCompletedMessage);
				expect(claims, `${value}/${variant.value} modem claim`).to.equal(provisions);
			}
		}
	});

	it('offers a headless variant with a completion message on every ubuntu workflow', () => {
		for (const value of ['ubuntu20', 'ubuntu24', 'ubuntu26', 'qli20']) {
			const headless = byValue(value).variants.find((v) => v.value === 'headless');
			expect(headless, `${value} headless variant`).to.exist;
			expect(headless.setupCompletedMessage, `${value} headless message`).to.be.a('string');
		}
	});
});
