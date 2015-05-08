var request = require('request');
var utilities = require('../lib/utilities');
var settings = require('../settings');
var chalk = require('chalk');
var path = require('path');

function APIClient2(baseUrl, token) {

	this.__baseUrl = baseUrl || settings.apiUrl;
	this.__token = token;

};

APIClient2.prototype.login = function(clientId, user, pass, cb) {

	self = this;

	this.createAccessToken(clientId, user, pass, tokenResponse);
	function tokenResponse(err, dat) {

		if(err) {

			return cb(err);
		}

		cb(null, dat);
	};
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

	}, function (error, res, body) {

		if (error || body.error) {

			cb(new Error(error || body.error));

		} else {
			// TODO: Snag token as self.__token
			// >>>
			console.log(arrow, 'DEBUG');
			console.log(body);
			console.log();

			cb(null, body);
		}
	});
};

var cmd = path.basename(process.argv[1]);
var alert = chalk.yellow('!');
var arrow = chalk.green('>');


module.exports = APIClient2;
