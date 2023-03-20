const fs = require('fs-extra');
const { expect } = require('../../test/setup');
const deviceSpecs = require('./device-specs');

describe('Device Specs', () => {
	it('contains entries where the keys are the DFU vendor and product IDs', () => {
		expect(Object.keys(deviceSpecs)).to.include('2b04:d006');
	});

	it('contains all the public platforms', () => {
		expect(Object.values(deviceSpecs).map(d => d.name)).to.eql([
			'core',
			'photon',
			'p1',
			'electron',
			'argon',
			'boron',
			'xenon',
			'esomx',
			'bsom',
			'b5som',
			'tracker',
			'trackerm',
			'p2',
			'muon'
		]);
	});

	it('has required properties on each platform', () => {
		for (const specs of Object.values(deviceSpecs)) {
			expect(specs).to.haveOwnProperty('name').that.is.a('string').not.empty;
			expect(specs).to.haveOwnProperty('productName').that.is.a('string').not.empty;
			expect(specs).to.haveOwnProperty('productId').that.is.a('number');
			expect(specs).to.haveOwnProperty('generation').that.is.a('number');
			expect(specs).to.haveOwnProperty('features').that.is.an('array');
			expect(specs).to.haveOwnProperty('defaultProtocol').that.is.a('string').not.empty;
			expect(specs).to.haveOwnProperty('serial').that.is.an('object');
			expect(specs).to.haveOwnProperty('knownApps').that.is.an('object');
		}
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
			const unsupported = ['Asset Tracker', 'Tracker M', 'Photon 2 / P2', 'Muon', 'E SoM X'];

			for (const specs of Object.values(deviceSpecs)){
				const { productName, knownApps } = specs;

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

