'use strict';
const chalk = require('chalk');
const VError = require('verror');
const settings = require('../../settings');
const ApiClient = require('../lib/api-client');
const spinnerMixin = require('../lib/spinner-mixin');
const { ensureAuth } = require('../lib/auth-helper');

const arrow = chalk.green('>');


module.exports = class WhoAmICommand {
	constructor() {
		spinnerMixin(this);
	}

	async getUsername(){
		await ensureAuth({ required: true });
		const api = new ApiClient();

		return Promise.resolve()
			.then(() => {

				this.newSpin('Checking...').start();

				return api.getUser();
			})
			.then(user => {
				const username = settings.username || user.username || 'unknown username';

				this.stopSpin();

				console.log(arrow, username);
				return username;
			})
			.catch(error => {
				this.stopSpin();

				if (error instanceof VError){
					throw error;
				}
				throw new VError('Failed to find username! Try: `particle login`');
			});
	}
};

