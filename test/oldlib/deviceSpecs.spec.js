import {expect, sinon} from '../test-setup';
import deviceSpecs from '../../oldlib/deviceSpecs';

describe('deviceSpecs', function() {
	describe('deviceId', function() {
		it('returns the deviceId from a serial number', function() {
			const photonSpecs = deviceSpecs['2b04:d006'];
			const serialNumber = 'Particle_Photon_70172efbc4b6719da784073f';
			const deviceId = '70172efbc4b6719da784073f';
			expect(photonSpecs.serial.deviceId(serialNumber)).to.eq(deviceId);
		});
		it('returns the deviceId from the PNP ID', function() {
            const photonSpecs = deviceSpecs['2b04:d006'];
            const pnpId = 'USB\\VID_2B04&PID_C006\\70172efbc4b6719da784073f';
            const deviceId = '70172efbc4b6719da784073f';
            expect(photonSpecs.serial.deviceId(pnpId)).to.eq(deviceId);
        });
		it('returns undefined when there is no serial number', function() {
			const photonSpecs = deviceSpecs['2b04:d006'];
			const serialNumber = 'Particle_Photon';
			expect(photonSpecs.serial.deviceId(serialNumber)).to.eq(undefined);
		});
		it('returns undefined when passing null serial number', function() {
			const photonSpecs = deviceSpecs['2b04:d006'];
			expect(photonSpecs.serial.deviceId(null)).to.eq(undefined);
		});
	});
});
