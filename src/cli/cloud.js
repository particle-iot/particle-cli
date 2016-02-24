import when from 'when';
import pipeline from 'when/pipeline';

import * as ui from './ui';
import prompts from './prompts';
import cloudLib from '../lib/cloud';
import { UnauthorizedError } from '../lib/api';
import log from './log';
import settings from '../../settings';

function login(opts) {
	const qs = [];
	if (!opts.username) {
		qs.push(prompts.username(opts.defaultUsername));
	}
	if (!opts.password) {
		qs.push(prompts.password());
	}

	if (qs.length) {
		return ui.prompt(qs).then(ans => {
			const user = opts.username || ans.username;
			const pass = opts.password || ans.password;

			opts.defaultUsername = user;
			return doLogin(user, pass);
		});
	}

	return doLogin(opts.username, opts.password);
}

function doLogin(user, pass) {
	return ui.spin(cloudLib.login(user, pass), 'Sending login details...')
		.then(token => {
			log.success('Successfully completed login!');
			settings.override(null, 'access_token', token);
			if (user) {
				settings.override(null, 'username', user);
			}
		});
}

const cloud = {
	login: ui.retry(login, 3, (err) => {
		log.warn("There was an error logging you in! Let's try again.");
		log.error(err);
	}, (err) => {
		log.error('Unable to login :(');
		log.error(err);
	}),

	logout: (opts) => {
		// TODO ensure logged in first
		const qs = [];
		if (opts.revoke && !opts.password) {
			qs.push(prompts.password());
		}
		if (!opts.revoke) {

		}

		if (opts.revoke) {
			return pipeline([
				() => {
					if (qs.length) {
						return ui.prompt(qs);
					}
					return when.resolve();
				},
				(ans) => {
					const pass = opts.password || ans.password;
					return cloudLib.removeAccessToken(settings.username, pass, settings.access_token);
				}
			]);
		}
		return cloudLib.logout();
	},

	listDevices: (opts) => {
		cloudLib.listDevices()
			.then(data => {
				console.log(data);
			})
			.catch(UnauthorizedError, () => {
				log.error('Not logged in');
			})
			.catch(err => {
				log.error('ERROR', err);
			});
	}
};

export default cloud;
