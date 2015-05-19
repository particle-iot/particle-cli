var request = require('request');
var utilities = require('../lib/utilities');
var settings = require('../settings');
var chalk = require('chalk');
var path = require('path');

function APIClient2(baseUrl, token) {

	this.__baseUrl = baseUrl || settings.apiUrl;
	this.__token = token;

}

APIClient2.prototype.updateToken = function(token) {
	this.__token = token;
};

APIClient2.prototype.clearToken = function(token) {
	this.__token = null;
};

APIClient2.prototype.login = function(clientId, user, pass, cb) {
	this.createAccessToken(clientId, user, pass, function tokenResponse(err, dat) {
		if(err) {
			return cb(err);
		}

		cb(null, dat);
	});
};

APIClient2.prototype.createUser = function(user, pass, cb) {
	var self = this;

	if (!user || (user === '')
		|| (!utilities.contains(user, '@'))
		|| (!utilities.contains(user, '.')))
	{
		return cb('Username must be an email address.');
	}

	request({
		uri: self.__baseUrl + '/v1/users',
		method: 'POST',
		form: {
			username: user,
			password: pass
		},
		json: true
	}, function (error, response, body) {
		if (error) {
			return cb(error);
		}

		if (body && !body.ok && body.errors) {
			return cb(body.errors);
		}

		return cb(null, body);
	});
};

APIClient2.prototype.createAccessToken = function(clientId, user, pass, cb) {

	var self = this;
	request({

		uri: self.__baseUrl + "/oauth/token",
		method: "POST",
		form: {

			username: user,
			password: pass,
			grant_type: 'password',
			client_id: clientId,
			client_secret: "client_secret_here"

		},
		json: true

	}, function (err, res, body) {

		if (err || body.error) {

			cb(new Error(err || body.error));

		} else {

			// update the token
			if(body.access_token) {

				settings.override(
					settings.profile,
					'access_token',
					body.access_token
				);

				self.__token = body.access_token;
			}

			// console.log(arrow, 'DEBUG');
			// console.log(body);
			// console.log();

			cb(null, body);
		}
	});
};

APIClient2.prototype.getClaimCode = function(cb) {

	var self = this;

	request({

		uri: self.__baseUrl + '/v1/device_claims',
		method: 'POST',
		auth: {
			'bearer': self.__token
		},
		json: true

	}, function (err, res, body) {
		if (err) {
			return cb(err);
		}
		if (body && !body.ok) {
			return cb(body.errors || 'Error getting claim code');
		}
		if (!(body && body.claim_code)) {
			return cb(new Error('no claim code returned'));
		}

		cb(null, body);
	});
};


var cmd = path.basename(process.argv[1]);
var alert = chalk.yellow('!');
var arrow = chalk.green('>');


module.exports = APIClient2;
