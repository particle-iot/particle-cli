import when from 'when';
import Particle from 'particle-api-js';
import log from '../cli/log';
import _ from 'lodash';
import url from 'url';

class UnauthorizedError extends Error {
	constructor(message) {
		super();
		this.message = message || 'Invalid access token';
		this.name = UnauthorizedError.name;
		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(this, UnauthorizedError);
		}
	}
}

class ParticleApi {
	constructor(baseUrl, options) {
		this.api = new Particle({
			baseUrl: baseUrl,
			clientId: options.clientId || 'particle-cli',
			clientSecret: 'particle-cli',
			tokenDuration: 7776000, // 90 days
			debug: this._debug.bind(this)
		});
		this.accessToken = options.accessToken;
	}

	login(username, password) {
		return when(this.api.login({ username: username, password: password }))
			.then(result => {
				this.accessToken = result.body.access_token;
			});
	}

	logout() {
		this.accessToken = undefined;
		return when.resolve();
	}

	removeAccessToken(username, password, token) {
		return when(this.api.removeAccessToken({ username, password, token }))
			.then(() => {
				if (token === this.accessToken) {
					this.logout();
				}
			});
	}

	listDevices() {
		return this._wrap(this.api.listDevices({ auth: this.accessToken }));
	}

	getDeviceAttributes(deviceId) {
		return this._wrap(this.api.getDevice({ deviceId, auth: this.accessToken }));
	}

	claimDevice(deviceId, requestTransfer) {
		return this._wrap(this.api.claimDevice({ deviceId, requestTransfer, auth: this.accessToken }));
	}

	_wrap(promise) {
		return when(promise)
			.then(result => result.body)
			.catch(this._checkToken);
	}

	_checkToken(err) {
		if (err.statusCode === 401) {
			return when.reject(new UnauthorizedError());
		}
		return when.reject(err);
	}

	_debug(req) {
		if (global.verboseLevel > 2) {
			const parsedUrl = url.parse(req.url);
			parsedUrl.query = req.qs;
			const destUrl = url.format(parsedUrl);
			log.silly('REQUEST');
			log.silly(`${req.method.toUpperCase()} ${destUrl}`);
			if (Object.keys(req.header).length) {
				log.silly(_.map(req.header, (v, k) => `${k}: ${v.replace(this.accessToken, '<redacted>')}`).join('\n'));
			}
			const clonedData = Object.assign({}, req._data);
			if (clonedData.password) {
				clonedData.password = '<redacted>';
			}
			log.silly(clonedData);
			req.on('response', res => {
				log.silly();
				log.silly('RESPONSE');
				log.silly(res.statusCode);
				log.silly(res.text);
				log.silly();
			});
		}
	}
};

export default ParticleApi;
export { UnauthorizedError };
