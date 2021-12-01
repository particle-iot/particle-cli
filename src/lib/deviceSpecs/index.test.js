const fs = require('fs-extra');
const { expect } = require('../../../test/setup');
const deviceSpecs = require('./index');
const specs2 = deviceSpecs.specs2;


describe('Device Specs', () => {
	it('contains entries where the keys are the DFU vendor and product IDs', () => {
		expect(Object.keys(specs2)).to.include('2b04:d006');
	});

	it('has a productName on each entry', () => {
		for (const device of Object.values(specs2)) {
			expect(device).to.haveOwnProperty('productName');
		}
	});

	describe('platforms', () => {
		function ignoreFields(specs) {
			// eslint-disable-next-line no-unused-vars
			const { features, generation, ...rest } = specs;
			return rest;
		}

		it('matches Core', () => {
			const dfuId = '1d50:607f';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches Photon', () => {
			const dfuId = '2b04:d006';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches P1', () => {
			const dfuId = '2b04:d008';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches Electron', () => {
			const dfuId = '2b04:d00a';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches Argon', () => {
			const dfuId = '2b04:d00c';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches Boron', () => {
			const dfuId = '2b04:d00d';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches Xenon', () => {
			const dfuId = '2b04:d00e';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches B SoM', () => {
			const dfuId = '2b04:d017';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches B5 SoM', () => {
			const dfuId = '2b04:d019';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
		it('matches Asset Tracker', () => {
			const dfuId = '2b04:d01a';
			expect(ignoreFields(specs2[dfuId])).to.deep.eql(ignoreFields(deviceSpecs[dfuId]));
		});
	});

	describe('deviceId', () => {
		it('returns the deviceId from a serial number', () => {
			const photonSpecs = deviceSpecs['2b04:d006'];
			const serialNumber = 'Particle_Photon_70172efbc4b6719da784073f';
			const deviceId = '70172efbc4b6719da784073f';
			expect(photonSpecs.serial.deviceId(serialNumber)).to.equal(deviceId);
		});

		it('returns the deviceId from the PNP ID', () => {
			const photonSpecs = deviceSpecs['2b04:d006'];
			const pnpId = 'USB\\VID_2B04&PID_C006\\70172efbc4b6719da784073f';
			const deviceId = '70172efbc4b6719da784073f';
			expect(photonSpecs.serial.deviceId(pnpId)).to.equal(deviceId);
		});

		it('returns undefined when there is no serial number', () => {
			const photonSpecs = deviceSpecs['2b04:d006'];
			const serialNumber = 'Particle_Photon';
			expect(photonSpecs.serial.deviceId(serialNumber)).to.equal(undefined);
		});

		it('returns undefined when passing null serial number', () => {
			const photonSpecs = deviceSpecs['2b04:d006'];
			expect(photonSpecs.serial.deviceId(null)).to.equal(undefined);
		});
	});

	describe('knownApps', () => {
		it('includes `tinker` in `known apps` for offical platforms', async () => {
			const unsupported = ['Core', 'Duo', 'A SoM', 'X SoM', 'Asset Tracker'];

			for (const spec of Object.values(deviceSpecs)){
				const { productName, knownApps } = spec;

				if (unsupported.includes(productName)){
					continue;
				}

				const msg = `Checking ${productName}...`;

				expect(knownApps, msg)
					.to.have.property('tinker').that.is.a('string');
				expect(await fs.exists(knownApps.tinker), msg)
					.to.equal(true);
			}
		});
	});
});

