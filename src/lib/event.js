import settings from '../../settings';
import ParticleApi from './api';

const api = new ParticleApi(settings.apiUrl, {
	accessToken: settings.access_token
});

export default {
	subscribe(deviceId, name) {
		return api.getEventStream(deviceId, name);
	}
};
