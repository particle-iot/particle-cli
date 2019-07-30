const { expect } = require('../../../test/setup');
const deviceSpecs = require('./index');


describe('Device Specs', () => {

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
});

