const _ = require('lodash');
const semver = require('semver');
const packageJson = require('../../package.json');


module.exports = function hasSupportedNode(options) {
	options = options || {};
	var version = options.version || process.version;
	var json = options.json || packageJson;
	var exit = options.exit || process.exit;
	var _console = options.console || console;
	var requirement = _.get(json, 'engines.node');

	if (!semver.satisfies(version, requirement)) {
		_console.error('The Particle CLI requires Node ' + requirement);
		exit(1);
		return false;
	}
	return true;
};

