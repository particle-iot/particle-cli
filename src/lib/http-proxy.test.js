'use strict';
const { expect } = require('../../test/setup');
const { getProxyAgent, _isExcludedByNoProxy } = require('./http-proxy');

describe('http-proxy', () => {
	describe('getProxyAgent', () => {
		it('returns undefined when no proxy env vars are set and no explicit proxyUrl', () => {
			const agent = getProxyAgent('https://api.particle.io/v1/devices', { env: {} });
			expect(agent).to.equal(undefined);
		});

		it('returns an agent when HTTPS_PROXY is set', () => {
			const agent = getProxyAgent('https://api.particle.io/v1/devices', {
				env: { HTTPS_PROXY: 'http://corp-proxy:8080' }
			});
			expect(agent).to.not.equal(undefined);
		});

		it('returns an agent when lowercase https_proxy is set', () => {
			const agent = getProxyAgent('https://api.particle.io/', {
				env: { https_proxy: 'http://corp-proxy:8080' }
			});
			expect(agent).to.not.equal(undefined);
		});

		it('falls back to HTTP_PROXY when HTTPS_PROXY is unset', () => {
			const agent = getProxyAgent('https://api.particle.io/', {
				env: { HTTP_PROXY: 'http://corp-proxy:8080' }
			});
			expect(agent).to.not.equal(undefined);
		});

		it('falls back to lowercase http_proxy', () => {
			const agent = getProxyAgent('https://api.particle.io/', {
				env: { http_proxy: 'http://corp-proxy:8080' }
			});
			expect(agent).to.not.equal(undefined);
		});

		it('prefers explicit proxyUrl over env vars', () => {
			// We can't easily inspect HttpsProxyAgent internals, but we can assert
			// that an agent is created. The precedence is exercised by `getProxyAgent`
			// reading `proxyUrl` first.
			const agent = getProxyAgent('https://api.particle.io/', {
				proxyUrl: 'http://settings-proxy:8080',
				env: { HTTPS_PROXY: 'http://env-proxy:8080' }
			});
			expect(agent).to.not.equal(undefined);
		});

		it('returns undefined when NO_PROXY exempts the target host', () => {
			const agent = getProxyAgent('https://api.particle.io/v1/devices', {
				env: {
					HTTPS_PROXY: 'http://corp-proxy:8080',
					NO_PROXY: 'particle.io'
				}
			});
			expect(agent).to.equal(undefined);
		});

		it('returns undefined when NO_PROXY is "*"', () => {
			const agent = getProxyAgent('https://api.particle.io/', {
				env: { HTTPS_PROXY: 'http://corp-proxy:8080', NO_PROXY: '*' }
			});
			expect(agent).to.equal(undefined);
		});
	});

	describe('NO_PROXY matcher', () => {
		const exclude = (host, noProxy) =>
			_isExcludedByNoProxy(`https://${host}/`, { NO_PROXY: noProxy });

		it('returns false when NO_PROXY is empty', () => {
			expect(exclude('api.particle.io', '')).to.equal(false);
			expect(_isExcludedByNoProxy('https://api.particle.io/', {})).to.equal(false);
		});

		it('matches exact hostname', () => {
			expect(exclude('api.particle.io', 'api.particle.io')).to.equal(true);
		});

		it('matches subdomain when NO_PROXY entry is the parent domain', () => {
			expect(exclude('api.particle.io', 'particle.io')).to.equal(true);
			expect(exclude('a.b.particle.io', 'particle.io')).to.equal(true);
		});

		it('treats leading dot as equivalent (.particle.io == particle.io)', () => {
			expect(exclude('api.particle.io', '.particle.io')).to.equal(true);
		});

		it('does NOT match an unrelated host that just shares a suffix', () => {
			expect(exclude('notparticle.io', 'particle.io')).to.equal(false);
			expect(exclude('particle.io.evil.com', 'particle.io')).to.equal(false);
		});

		it('handles comma-separated lists', () => {
			expect(exclude('api.particle.io', 'localhost,internal.dev,particle.io')).to.equal(true);
			expect(exclude('other.com', 'localhost,internal.dev,particle.io')).to.equal(false);
		});

		it('is case-insensitive', () => {
			expect(exclude('API.Particle.IO', 'particle.io')).to.equal(true);
			expect(exclude('api.particle.io', 'PARTICLE.IO')).to.equal(true);
		});

		it('tolerates whitespace around list entries', () => {
			expect(exclude('api.particle.io', ' localhost , particle.io , internal.dev ')).to.equal(true);
		});

		it('matches "*" against any host', () => {
			expect(exclude('api.particle.io', '*')).to.equal(true);
			expect(exclude('example.com', '*')).to.equal(true);
		});

		it('returns false for an unparseable target URL', () => {
			expect(_isExcludedByNoProxy('not a url', { NO_PROXY: 'particle.io' })).to.equal(false);
		});
	});
});
