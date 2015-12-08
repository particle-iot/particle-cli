'use strict';

var settings = require('../settings');
var api = require('./api')(settings.apiUrl, settings.access_token);

var cloud = {
	login: function login(user, pass) {
		return api.login(user, pass);
	}
};

module.exports = cloud;
