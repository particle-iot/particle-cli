'use strict';

var dfu = require('../../oldlib/dfu');
var fs = require('fs');
var path = require('path');
var assert = require('assert');

describe('DFU', function() {
	it('finds Particle devices in dfu-util -l output', function() {
		var output = fs.readFileSync(path.join(__dirname, './fixtures/dfu/only_particle.txt')).toString();
		var devices = dfu._deviceIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 1);
		assert.equal(devices[0], '2b04:d006');
	});

	it('filters out non-Particle devices in dfu-util -l output', function() {
		var output = fs.readFileSync(path.join(__dirname, './fixtures/dfu/mixed.txt')).toString();
		var devices = dfu._deviceIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 1);
		assert.equal(devices[0], '2b04:d00a');
	});

	it('handles no devices output', function() {
		var output = fs.readFileSync(path.join(__dirname, './fixtures/dfu/none.txt')).toString();
		var devices = dfu._deviceIdsFromDfuOutput(output);
		assert.ok(devices);
		assert.equal(devices.length, 0);
	});
});
