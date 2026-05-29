'use strict';
const chalk = require('chalk');
const spinnerMixin = require('../lib/spinner-mixin');
const CLICommandBase = require('./base');
const { requireToken, getCurrentUsername } = require('../lib/api-call');

const arrow = chalk.green('>');


module.exports = class WhoAmICommand extends CLICommandBase {
	constructor(options = {}) {
		super(options);
		spinnerMixin(this);
	}

	async getUsername() {
		requireToken();

		this.newSpin('Checking...').start();
		try {
			const username = await getCurrentUsername();
			console.log(arrow, username);
			return username;
		} finally {
			this.stopSpin();
		}
	}
};
