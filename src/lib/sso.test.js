const nock = require('nock');
const jose = require('jose');
const openurl = require('./openurl');
const { sinon, expect } = require('../../test/setup');
const sandbox = sinon.createSandbox();
const { _makeRequest, waitForLogin, ssoLogin } = require('./sso');

describe('_makeRequest', () => {
	it('make a request', async () => {
		const response = '{"foo":"bar"}';
		const stub = nock('https://id.staging.particle.io/oauth2/default/v1', )
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
		const stub = nock('https://id.staging.particle.io/oauth2/default/v1', )
			.intercept('/token', 'POST')
			.replyWithError(response);
		const url = 'https://id.staging.particle.io/oauth2/default/v1/token';
		const method = 'POST';
		const form = {};
		try {
			await _makeRequest({ url, method, form });
		} catch (error) {
			expect(error.message).to.equal(response);
		}
		expect(stub.isDone()).to.be.true;
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

		nock('https://id.particle.io/oauth2/default/v1', )
			.intercept('/token', 'POST')
			.reply(200, pendingResponse);

		nock('https://id.particle.io/oauth2/default/v1', )
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

		nock('https://id.particle.io/oauth2/default/v1', )
			.intercept('/token', 'POST')
			.reply(200, pendingResponse);

		nock('https://id.particle.io/oauth2/default/v1', )
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

		nock('https://id.particle.io/oauth2/default/v1', )
			.intercept('/token', 'POST')
			.reply(200, pendingResponse);

		nock('https://id.particle.io/oauth2/default/v1', )
			.intercept('/token', 'POST')
			.replyWithError(unhandledError);

		try {
			await waitForLogin({ deviceCode: 'XXAABBCC', waitTime: 1 });
		} catch (error) {
			expect(error.message).to.equal(unhandledError);
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

		nock('https://id.particle.io/oauth2/default/v1', )
			.intercept('/device/authorize', 'POST')
			.reply(200, authorize);

		nock('https://id.particle.io/oauth2/default/v1', )
			.intercept('/token', 'POST')
			.reply(200, accessTokenResponse);
		const response = await ssoLogin();
		expect(openUrlSpy).to.be.calledWith('https://id.particle.io/activate?user_code=STHWXLHB');
		expect(response.deviceCode).to.equal('STHWXLHB');
		expect(response.verificationUriComplete).to.equal('https://id.particle.io/activate?user_code=STHWXLHB');
	});
});
