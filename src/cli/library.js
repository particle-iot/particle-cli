import ParticleApi from '../cmd/api';
import settings from '../../settings';

import libraryAdd from './library_add';
import libraryInstall from './library_install';
import libraryView from './library_view';
import libraryMigrate from './library_migrate';
import libraryInit from './library_init';
import libraryList from './library_list';
import librarySearch from './library_search';
import libraryContribute from './library_upload';
import libraryPublish from './library_publish';
import libraryDelete from './library_delete';

function api() {
	if (!api._instance) {
		api._instance = new ParticleApi(settings.apiUrl, {
			accessToken: settings.access_token
		}).api;
	}
	return api._instance;
}

export default ({root, factory}) => {
	const lib = factory.createCategory(root, 'library', 'Manages firmware libraries', { alias: 'libraries' });

	libraryAdd({lib, factory, apiJS: api()});
	libraryInit({lib, factory});
	libraryInstall({lib, factory, apiJS: api()});
	libraryView({lib, factory, apiJS: api()});
	libraryList({lib, factory, apiJS: api()});
	libraryMigrate({lib, factory});
	librarySearch({lib, factory, apiJS: api()});
	libraryContribute({lib, factory, apiJS: api()});
	libraryPublish({lib, factory, apiJS: api()});
	libraryDelete({lib, factory, apiJS: api()});

	return lib;
};
