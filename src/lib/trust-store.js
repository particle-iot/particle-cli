'use strict';
const { X509Certificate } = require('crypto');

const REMOVED_ROOTS = [
	'emSign ECC Root CA - G3',
	'emSign Root CA - C1',
	'emSign ECC Root CA - C3'
];

function commonName(pem) {
	const match = new X509Certificate(pem).subject.match(/^CN=(.*)$/m);
	return match ? match[1] : '';
}

module.exports = function applyTrustStore(options) {
	options = options || {};
	const tls = options.tls || require('tls');
	const toRemove = new Set(options.removed || REMOVED_ROOTS);

	const removed = [];
	const kept = tls.getCACertificates('bundled').filter((pem) => {
		const name = commonName(pem);
		if (toRemove.has(name)) {
			removed.push(name);
			return false;
		}
		return true;
	});

	tls.setDefaultCACertificates(kept);
	return removed;
};

module.exports.REMOVED_ROOTS = REMOVED_ROOTS;
