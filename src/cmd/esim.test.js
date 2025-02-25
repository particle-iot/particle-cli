const { expect } = require('chai');
const sinon = require('sinon');
const ESimCommands = require('./esim');

describe('ESimCommands', () => {
	let esim;
	let cacheStub;

	beforeEach(() => {
		esim = new ESimCommands();
		esim.inputJsonData = {
			provisioning_data: [
				{ profiles: [{ iccid: '123' }] },
				{ profiles: [{ iccid: '456' }] },
				{ profiles: [{ iccid: '789' }] }
			]
		};
		cacheStub = sinon.stub(esim.cache, 'get');
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('_generateAvailableProvisioningData', () => {

		it('should populate availableProvisioningData with all profiles when cache is empty', async () => {
			cacheStub.returns([]);
			await esim._generateAvailableProvisioningData();
			expect(esim.availableProvisioningData.size).to.equal(3);
			expect(esim.availableProvisioningData.has(0)).to.be.true;
			expect(esim.availableProvisioningData.has(1)).to.be.true;
			expect(esim.availableProvisioningData.has(2)).to.be.true;
		});

		it('should remove provisioned profiles from availableProvisioningData', async () => {
			cacheStub.returns([[{ iccid: '456' }]]);
			await esim._generateAvailableProvisioningData();
			expect(esim.availableProvisioningData.size).to.equal(2);
			expect(esim.availableProvisioningData.has(0)).to.be.true;
			expect(esim.availableProvisioningData.has(1)).to.be.false;
			expect(esim.availableProvisioningData.has(2)).to.be.true;
		});

		it('should remove all profiles from availableProvisioningData if all are provisioned', async () => {
			cacheStub.returns([[{ iccid: '123' }], [{ iccid: '456' }], [{ iccid: '789' }]]);
			await esim._generateAvailableProvisioningData();
			expect(esim.availableProvisioningData.size).to.equal(0);
		});

		it('should handle corrupted cache data gracefully', async () => {
			cacheStub.returns('{not valid json}');
			await esim._generateAvailableProvisioningData();
			expect(esim.availableProvisioningData.size).to.equal(3);
		});

	});
});
