var path = require('path');
var specs = require('./specifications');
var dir = require('../../settings').ensureFolder();
var fs = require('fs');

function userDeviceSpecs() {

	var specFile = path.join(dir, 'device-specs.json');
	if (!fs.existsSync(specFile)) { return; }
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

	//fix the paths on the known apps mappings
	Object.keys(specs).forEach(function (id) {
		var deviceSpecs = specs[id];
		var knownApps = deviceSpecs["knownApps"];
		for(var appName in knownApps) {
			knownApps[appName] =  path.join(__dirname,"binaries", knownApps[appName]);
		};
	});
};

userDeviceSpecs();
module.exports = specs;