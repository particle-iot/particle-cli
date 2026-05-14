'use strict';
const chalk = require('chalk');
const settings = require('../../settings');
const spinnerMixin = require('../lib/spinner-mixin');
const CLICommandBase = require('./base');
const { requireToken } = require('../lib/api-call');

const arrow = chalk.green('>');


module.exports = class WhoAmICommand extends CLICommandBase {
	constructor(options = {}) {
		super(options);
		spinnerMixin(this);
	}

	async getUsername() {
		requireToken();

		const { api } = this._particleApi();

		this.newSpin('Checking...').start();
		try {
			const user = await api.getUserInfo();
			const username = settings.username || user.username || 'unknown username';
			console.log(arrow, username);
			return username;
		} finally {
			this.stopSpin();
		}
	}
};
