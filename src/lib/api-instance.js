'use strict';

/**
 * Token-propagation registry for live `ParticleApi` instances.
 *
 * Contract:
 *   - Every `ParticleApi` registers itself in its constructor via `register(this)`.
 *   - Any code path that mutates `settings.access_token` MUST call `setTokenOnAll(token)`
 *     immediately afterward so every live instance picks up the new token.
 *
 * Why a registry rather than a singleton: per-command `ParticleApi` instances are
 * vulnerable to mid-flight token rotation. A singleton would only cover the
 * long-lived library client and miss every other command's instance. The registry
 * covers all live instances uniformly.
 */

const instances = new Set();

function register(instance) {
	instances.add(instance);
}

function unregister(instance) {
	instances.delete(instance);
}

function setTokenOnAll(token) {
	for (const instance of instances) {
		if (typeof instance.setAccessToken === 'function') {
			instance.setAccessToken(token);
		}
	}
}

// Test-only: clear the registry between cases. Production code must not call this.
function __resetForTests() {
	instances.clear();
}

module.exports = { register, unregister, setTokenOnAll, __resetForTests };
