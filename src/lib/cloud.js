import settings from '../../settings';
import ParticleApi from './api';
import pipeline from 'when/pipeline';
import _ from 'lodash';
import when from 'when';
import { platformsByName } from './constants';

const api = new ParticleApi(settings.apiUrl, {
	accessToken: settings.access_token
});

export default {
	login(user, pass) {
		return api.login(user, pass);
	},

	logout() {
		return api.logout();
	},

	removeAccessToken(user, pass, token) {
		return api.removeAccessToken(user, pass, token);
	},

	listDevices(filter) {
		return pipeline([
			api.listDevices.bind(api),
			(devices) => {
				return when.map(devices, d => {
					if (d.connected) {
						return api.getDeviceAttributes(d.id)
							.then(attrs => Object.assign(d, attrs));
					}
					return d;
				});
			},
			(devices) => {
				return _.sortBy(devices, 'name');
			},
			(devices) => {
				if (!filter) {
					return devices;
				}

				switch (true) {
					case (filter === 'online'):
						return devices.filter(d => d.connected);
					case (filter === 'offline'):
						return devices.filter(d => !d.connected);
					case (Object.keys(platformsByName).indexOf(filter.toLowerCase()) >= 0):
						return devices.filter(d => d.platform_id === platformsByName[filter.toLowerCase()]);
					default:
						return devices.filter(d => d.name === filter || d.id === filter);
				}
			}
		]);
	},

	claimDevice(deviceId, requestTransfer) {
		return api.claimDevice(deviceId, requestTransfer);
	},

	removeDevice(deviceIdOrName) {
		return api.removeDevice(deviceIdOrName);
	}
};
