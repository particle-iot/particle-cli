'use strict';

var Particle = require('@particle/api');

function ParticleApi(baseUrl, options) {
	if (!(this instanceof ParticleApi)) {
		return new ParticleApi(baseUrl, options);
	}

	this.api = new Particle({
		baseUrl: baseUrl,
		clientId: options.clientId || 'CLI',
		clientSecret: 'client_secret_here',
		tokenDuration: 7776000, // 90 days
	});
	this.accessToken = options.accessToken;
}

ParticleApi.prototype = {
	login: function(username, password) {
		return this.api.login({ username: username, password: password })
			.then(function (result) {
				this.accessToken = result.body.access_token;
			}.bind(this));
	},

	logout: function() {
		this.accessToken = undefined;
	},

	removeAccessToken: function(username, password, token) {
		var args = { username: username, password: password, token: token };
		return this.api.removeAccessToken(args)
			.then(function () {
				if (token === this.accessToken) {
					this.logout();
				}
			}.bind(this));
	}
};

module.exports = ParticleApi;
