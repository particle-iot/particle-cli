'use strict';
const nock = require('nock');
const jose = require('jose');
const openurl = require('./openurl');
const { sinon, expect } = require('../../test/setup');
const { startProxyRecorder } = require('../../test/lib/proxy-recorder');
const settings = require('../../settings');
const sandbox = sinon.createSandbox();
const { _makeRequest, waitForLogin, ssoLogin } = require('./sso');

describe('_makeRequest', () => {
	it('make a request', async () => {
		const response = '{"foo":"bar"}';
		const stub = nock('https://id.staging.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.reply(200, response);
		const url = 'https://id.staging.particle.io/oauth2/default/v1/token';
		const method = 'POST';
		const form = {};
		const request = await _makeRequest({ url, method, form });
		expect(JSON.stringify(request)).to.equal(response);
		expect(stub.isDone()).to.be.true;
	});

	it('reject a request', async () => {
		const response = 'error message';
		const stub = nock('https://id.staging.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.replyWithError(response);
		const url = 'https://id.staging.particle.io/oauth2/default/v1/token';
		const method = 'POST';
		const form = {};
		try {
			await _makeRequest({ url, method, form });
		} catch (error) {
			expect(error.message).to.contain(response);
		}
		expect(stub.isDone()).to.be.true;
	});

	it('sends the form as an url-encoded body', async () => {
		const stub = nock('https://id.particle.io/oauth2/default/v1', {
			reqheaders: { 'content-type': /^application\/x-www-form-urlencoded/ }
		})
			.post('/token', 'device_code=XXAABBCC&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&client_id=my-client&scope=openid%20profile')
			.reply(200, { ok: true });
		const response = await _makeRequest({
			url: 'https://id.particle.io/oauth2/default/v1/token',
			method: 'POST',
			form: {
				device_code: 'XXAABBCC',
				grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
				client_id: 'my-client',
				scope: 'openid profile'
			}
		});
		expect(response).to.deep.equal({ ok: true });
		expect(stub.isDone()).to.be.true;
	});

	it('resolves the parsed body for non-2xx responses', async () => {
		// OAuth device flow servers answer `authorization_pending` with a 400,
		// so the body must be returned instead of rejecting on the status code
		const body = { error: 'authorization_pending', error_description: 'authorization is pending' };
		nock('https://id.particle.io/oauth2/default/v1')
			.post('/token')
			.reply(400, body);
		const response = await _makeRequest({
			url: 'https://id.particle.io/oauth2/default/v1/token',
			method: 'POST',
			form: {}
		});
		expect(response).to.deep.equal(body);
	});

	describe('proxy', () => {
		const request = () => _makeRequest({
			url: 'https://id.particle.io/oauth2/default/v1/token',
			method: 'POST',
			form: {}
		});
		const originalProxyUrl = settings.proxyUrl;
		const proxies = [];
		const startProxy = async (options) => {
			const proxy = await startProxyRecorder(options);
			proxies.push(proxy);
			return proxy;
		};

		afterEach(async () => {
			settings.proxyUrl = originalProxyUrl;
			// close in reverse order so each one restores the env it found
			while (proxies.length) {
				await proxies.pop().close();
			}
		});

		it('routes the request through HTTPS_PROXY', async () => {
			const proxy = await startProxy();

			await expect(request()).to.be.rejected;

			expect(proxy.requests).to.have.lengthOf(1);
			expect(proxy.requests[0]).to.match(/^CONNECT id\.particle\.io:443 /);
		});

		it('routes the request through the profile proxyUrl', async () => {
			const proxy = await startProxy({ setEnv: false });
			settings.proxyUrl = proxy.url;

			await expect(request()).to.be.rejected;

			expect(proxy.requests).to.have.lengthOf(1);
			expect(proxy.requests[0]).to.match(/^CONNECT id\.particle\.io:443 /);
		});

		it('prefers the profile proxyUrl over HTTPS_PROXY', async () => {
			const profileProxy = await startProxy({ setEnv: false });
			const envProxy = await startProxy();
			settings.proxyUrl = profileProxy.url;

			await expect(request()).to.be.rejected;

			expect(profileProxy.requests).to.have.lengthOf(1);
			expect(envProxy.requests).to.have.lengthOf(0);
		});
	});
});

describe('waitForLogin', () => {

	afterEach(() => {
		sandbox.restore();
	});

	it('wait until sso returns an access token', async() => {
		sandbox.stub(jose, 'createRemoteJWKSet').returns({});
		sandbox.stub(jose, 'jwtVerify').value(() => ({ payload: { particle_profile: 'my-token', sub: 'username' } }));

		const pendingResponse = {
			error: 'authorization_pending',
			error_description: 'authorization is pending'
		};

		const accessTokenResponse = {
			access_token: 'my.generated.token',
		};

		nock('https://id.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.reply(200, pendingResponse);

		nock('https://id.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.reply(200, accessTokenResponse);

		const response = await waitForLogin({ deviceCode: 'XXAABBCC', waitTime: 1 });
		expect(response.token).to.equal('my-token');
		expect(response.username).to.equal('username');
	});

	it('wait until sso returns an expired_code error', async() => {
		const pendingResponse = {
			error: 'authorization_pending',
			error_description: 'authorization is pending'
		};

		const expiredResponse = {
			error: 'expired_token',
			error_description: 'the device code is expired'
		};

		nock('https://id.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.reply(200, pendingResponse);

		nock('https://id.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.reply(200, expiredResponse);

		try {
			await waitForLogin({ deviceCode: 'XXAABBCC', waitTime: 1 });
		} catch (error) {
			expect(error.message).to.equal('the device code is expired');
		}
	});

	it('wait until sso returns unexpected error', async() => {
		const pendingResponse = {
			error: 'authorization_pending',
			error_description: 'authorization is pending'
		};
		const unhandledError = 'error message';

		nock('https://id.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.reply(200, pendingResponse);

		nock('https://id.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.replyWithError(unhandledError);

		try {
			await waitForLogin({ deviceCode: 'XXAABBCC', waitTime: 1 });
		} catch (error) {
			expect(error.message).to.contain(unhandledError);
		}
	});
});

describe('ssoLogin', () => {
	afterEach(() => {
		sandbox.restore();
	});

	it('send login request over sso', async() => {
		const authorize = {
			verification_uri_complete: 'https://id.particle.io/activate?user_code=STHWXLHB',
			device_code: 'STHWXLHB'
		};
		const accessTokenResponse = {
			access_token: 'my.generated.token',
		};
		sandbox.stub(jose, 'createRemoteJWKSet').returns({});
		sandbox.stub(jose, 'jwtVerify').value(() => ({ payload: { particle_profile: 'my-token', sub: 'username' } }));
		sandbox.stub(openurl, 'open').value(() => {});
		const openUrlSpy = sandbox.spy(openurl, 'open');

		nock('https://id.particle.io/oauth2/default/v1',)
			.intercept('/device/authorize', 'POST')
			.reply(200, authorize);

		nock('https://id.particle.io/oauth2/default/v1',)
			.intercept('/token', 'POST')
			.reply(200, accessTokenResponse);
		const response = await ssoLogin();
		expect(openUrlSpy).to.be.calledWith('https://id.particle.io/activate?user_code=STHWXLHB');
		expect(response.deviceCode).to.equal('STHWXLHB');
		expect(response.verificationUriComplete).to.equal('https://id.particle.io/activate?user_code=STHWXLHB');
	});
});
