const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { expect, sinon } = require('../../test/test-setup');
const dfu = require('./dfu');


describe('DFU', () => {
	const FIXTURES_DIR = path.join(__dirname, '../../test/lib/fixtures/dfu');

	it('finds Particle devices in dfu-util -l output', () => {
		var output = fs.readFileSync(path.join(FIXTURES_DIR, 'only_particle.txt')).toString();
		var devices = dfu._dfuIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 1);
		assert.equal(devices[0], '2b04:d006');
	});

	it('filters out non-Particle devices in dfu-util -l output', () => {
		var output = fs.readFileSync(path.join(FIXTURES_DIR, 'mixed.txt')).toString();
		var devices = dfu._dfuIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 1);
		assert.equal(devices[0], '2b04:d00a');
	});

	it('handles no devices output', () => {
		var output = fs.readFileSync(path.join(FIXTURES_DIR, 'none.txt')).toString();
		var devices = dfu._dfuIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 0);
	});

	it('pads to 2 on the core', () => {
		var specs = dfu.specsForPlatform(0);
		var file = 'abcd';
		dfu.appendToEvenBytes = sinon.spy();
		dfu.checkBinaryAlignment(file, specs);
		expect(dfu.appendToEvenBytes).to.have.been.calledWith(file);
	});

	it('does not pad on other platforms', () => {
		var specs = dfu.specsForPlatform(6);
		var file = 'abcd';
		dfu.appendToEvenBytes = sinon.spy();
		dfu.checkBinaryAlignment(file, specs);
		expect(dfu.appendToEvenBytes).to.have.not.been.called;
	});
});
