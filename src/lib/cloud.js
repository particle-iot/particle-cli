import settings from '../../settings';
import ParticleApi from './api';

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

	listDevices() {
		return api.listDevices();
	}
};
