import when from 'when';
import pipeline from 'when/pipeline';

import * as ui from './ui';
import prompts from './prompts';
import cloudLib from '../lib/cloud';
import { UnauthorizedError } from '../lib/api';
import log from './log';
import settings from '../../settings';
import { platformsById } from '../lib/constants';

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
	login(opts) {
		ui.retry(login, 3, (err) => {
			log.warn("There was an error logging you in! Let's try again.");
			log.error(err);
		}, (err) => {
			log.error('Unable to login :(');
			if (err) {
				log.error(err);
			}
		})(opts);
	},

	logout(opts) {
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

	listDevices(opts) {
		return pipeline([
			() => {
				return ui.spin(cloudLib.listDevices(opts.filter), 'Retrieving device functions and variables...');
			},
			(devices) => {
				if (devices.length === 0) {
					return log.info('No devices claimed to your account');
				}

				ui.render('deviceList', devices, { platformsById });
			}
		]).catch(UnauthorizedError, () => {
			log.error('Not logged in');
		});
	},

	claimDevice(opts) {
		return ui.spin(cloudLib.claimDevice(opts.deviceId, opts.requestTransfer),
			`Claiming device ${opts.deviceId}`)
			.then(body => {
				if (opts.requestTransfer && body.transfer_id) {
					log.success(`Transfer #${body.transfer_id} requested. You will receive an email if your transfer is approved or denied.`);
					return;
				}
				log.success(`Successfully claimed device ${opts.deviceId}`);
			})
			.catch(err => {
				const errors = err && err.body && err.body.errors;
				const msg = `Error claiming device: ${errors || err}`;
				if (errors && errors.join('\n').indexOf('That belongs to someone else.') >= 0) {
					if (global.isInteractive) {
						return ui.prompt([prompts.requestTransfer()]).then(ans => {
							if (ans.transfer) {
								return cloudLib.claimDevice(opts.deviceId, true).then(body => {
									log.success(`Transfer #${body.transfer_id} requested. You will receive an email if your transfer is approved or denied.`);
								}).catch(err => {
									return when.reject(err);
								});
							}
							return when.reject(msg);
						});
					}
				}
				return when.reject(msg);
			});
	},

	removeDevice(opts) {
		function doRemove() {
			return cloudLib.removeDevice(opts.deviceIdOrName)
				.then(() => {
					log.success(`Successfully removed device ${opts.deviceIdOrName} from your account`);
				})
				.catch(err => {
					const error = err && err.body && err.body.info;
					return when.reject(error || err);
				});
		}

		if (!opts.force) {
			if (!global.isInteractive) {
				return when.reject('Confirmation required, use -f argument to force removal.');
			}

			return ui.prompt([prompts.areYouSure(`you want to remove device ${opts.deviceIdOrName} from your account`)])
				.then(ans => {
					if (ans.sure) {
						return doRemove();
					}
					log.warn('Device was not removed');
				});
		}

		return doRemove();
	}
};

export default cloud;
