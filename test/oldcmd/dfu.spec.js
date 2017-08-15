'use strict';

var dfu = require('../../oldlib/dfu');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var specs = require('../../oldlib/deviceSpecs');
var sinon = require('sinon');

const chai = require('chai');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);
const expect = chai.expect;


describe('DFU', function() {
	it('finds Particle devices in dfu-util -l output', function() {
		var output = fs.readFileSync(path.join(__dirname, './fixtures/dfu/only_particle.txt')).toString();
		var devices = dfu._dfuIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 1);
		assert.equal(devices[0], '2b04:d006');
	});

	it('filters out non-Particle devices in dfu-util -l output', function() {
		var output = fs.readFileSync(path.join(__dirname, './fixtures/dfu/mixed.txt')).toString();
		var devices = dfu._dfuIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 1);
		assert.equal(devices[0], '2b04:d00a');
	});

	it('handles no devices output', function() {
		var output = fs.readFileSync(path.join(__dirname, './fixtures/dfu/none.txt')).toString();
		var devices = dfu._dfuIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 0);
	});

	it('pads to 2 on the core', () => {
		var specs = dfu.specsForPlatform(0);
		var file = 'abcd';
		dfu.appendToEvenBytes = sinon.spy();
		dfu.checkBinaryAlignment(file, specs);
		expect(dfu.appendToEvenBytes).to.have.been.calledWith(file)
	});

	it('does not pad on other platforms', () => {
		var specs = dfu.specsForPlatform(6);
		var file = 'abcd';
		dfu.appendToEvenBytes = sinon.spy();
		dfu.checkBinaryAlignment(file, specs);
		expect(dfu.appendToEvenBytes).to.have.not.been.called;
	});
});
