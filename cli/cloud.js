'use strict';

var when = require('when');
var chalk = require('chalk');
var Spinner = require('cli-spinner').Spinner;
Spinner.setDefaultSpinnerString(Spinner.spinners[7]);

var inquirer = require('inquirer');
var prompts = require('../lib/prompts');
var cloudLib = require('../lib/cloud');
var settings = require('../settings');

var arrow = chalk.green('>');
var alert = chalk.yellow('!');

function prompt(qs) {
	return when.promise(function (resolve) {
		inquirer.prompt(qs, function(answers) {
			resolve(answers);
		});
	});
}

function spin(promise, str) {
	var s = new Spinner(str);
	s.start();
	promise.finally(function () {
		s.stop(true);
	});
	return promise;
}

var tries = 0;
var cloud = {
	login: function login(opts) {
		if (this.tries >= 3) {
			console.log();
			console.log(alert, "It seems we're having trouble with logging in.");
			// TODO more helpful info?
			return when.reject();
		}

		var qs = [];
		if (!opts.username) {
			qs.push(prompts.getUsername(opts.defaultUsername));
		}
		if (!opts.password) {
			qs.push(prompts.getPassword());
		}

		if (qs.length) {
			return prompt(qs).then(function (ans) {
				var user = opts.username || ans.username;
				var pass = opts.password || ans.password;

				return doLogin(user, pass);
			});
		}

		return doLogin(opts.username, opts.password);
	}
};

function doLogin(user, pass) {
	return spin(cloudLib.login(user, pass), 'Sending login details...')
		.then(function (token) {
			console.log(arrow, 'Successfully completed login!');
			settings.override(null, 'access_token', token);
			if (user) {
				settings.override(null, 'username', user);
			}
		})
		.catch(function (err) {
			console.log(alert, "There was an error logging you in! Let's try again.");
			console.error(alert, err);
			tries++;

			return cloud.login({ defaultUsername: user });
		});
}

module.exports = cloud;
