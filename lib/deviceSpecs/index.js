var path = require('path');
var specs = require('./specifications');
var dir = require('../../settings').ensureFolder();
var fs = require('fs');

function userDeviceSpecs() {
	var specFile = path.join(dir, 'device-specs.json');
	var data = fs.readFileSync(specFile);
	var extend;
	try { extend = JSON.parse(data.toString()); }
	catch(e) {
		// TODO: use proper logging module
		console.log("Unable to parse " + specFile);
		return;
	}
	Object.keys(extend).forEach(function _extendSpecs(deviceSpec) {
		specs[deviceSpec] = extend[deviceSpec];
	});
}

userDeviceSpecs();
module.exports = specs;