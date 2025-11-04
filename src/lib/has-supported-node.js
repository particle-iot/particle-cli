'use strict';
const _ = require('lodash');
const semver = require('semver');
const packageJson = require('../../package.json');

module.exports = function hasSupportedNode(options) {
	options = options || {};
	const version = options.version || process.version;
	const json = options.json || packageJson;
	const exit = options.exit || process.exit;
	const log = options.console || console;
	const requirement = _.get(json, 'engines.node');

	if (!semver.satisfies(version, requirement)) {
		log.error('The Particle CLI requires Node ' + requirement);
		exit(1);
		return false;
	}
	return true;
};

