const fs = require('fs');
const path = require('path');
const { expect, sinon } = require('../../test/setup');
const dfu = require('./dfu');


describe('DFU', () => {
	const sandbox = sinon.createSandbox();
	const FIXTURES_DIR = path.join(__dirname, '../../test/__fixtures__/dfu');

	afterEach(() => {
		sandbox.restore();
	});

	it('finds Particle devices in dfu-util -l output', () => {
		const filename = path.join(FIXTURES_DIR, 'only_particle.txt');
		const output = fs.readFileSync(filename).toString();
		const devices = dfu._dfuIdsFromDfuOutput(output);

		expect(devices).to.be.an('array');
		expect(devices).to.have.lengthOf(1);
		expect(devices[0]).to.equal('2b04:d006');
	});

	it('filters out non-Particle devices in dfu-util -l output', () => {
		const filename = path.join(FIXTURES_DIR, 'mixed.txt');
		const output = fs.readFileSync(filename).toString();
		const devices = dfu._dfuIdsFromDfuOutput(output);

		expect(devices).to.be.an('array');
		expect(devices).to.have.lengthOf(1);
		expect(devices[0]).to.equal('2b04:d00a');
	});

	it('handles no devices output', () => {
		const filename = path.join(FIXTURES_DIR, 'none.txt');
		const output = fs.readFileSync(filename).toString();
		const devices = dfu._dfuIdsFromDfuOutput(output);

		expect(devices).to.be.an('array');
		expect(devices).to.have.lengthOf(0);
	});

	it('pads to 2 on the core', () => {
		sandbox.stub(dfu, 'appendToEvenBytes');
		const specs = dfu.specsForPlatform(0);
		const file = 'abcd';

		dfu.checkBinaryAlignment(file, specs);

		expect(dfu.appendToEvenBytes).to.have.property('callCount', 1);
		expect(dfu.appendToEvenBytes.firstCall.args).to.eql([file]);
	});

	it('does not pad on other platforms', () => {
		sandbox.stub(dfu, 'appendToEvenBytes');
		const specs = dfu.specsForPlatform(6);
		const file = 'abcd';

		dfu.checkBinaryAlignment(file, specs);

		expect(dfu.appendToEvenBytes).to.have.property('callCount', 0);
	});
});

