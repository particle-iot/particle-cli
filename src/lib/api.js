import when from 'when';
import Particle from 'particle-api-js';

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
		return when(this.api.listDevices({ auth: this.accessToken }))
			.then(result => result.body)
			.catch(this._checkToken);
	}

	_checkToken(err) {
		if (err.statusCode === 401) {
			return when.reject(new UnauthorizedError());
		}
		return when.reject(err);
	}
};

export default ParticleApi;
export { UnauthorizedError };
