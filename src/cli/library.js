import {LibraryAddCommand, LibraryAddCommandSite} from '../cmd';
import ParticleApi from '../cmd/api';
import settings from '../../settings';

import chalk from 'chalk';
import log from '../app/log';
import {spin} from '../app/ui';

import libraryInstall from './library_install';
import libraryMigrate from './library_migrate';
import libraryInit from './library_init';
import librarySearch from './library_search';
import libraryPublish from './library_publish';
import libraryDelete from './library_delete';
import {buildAPIClient} from './library_search';

//const ui = require('../cli/ui');

function api() {
	if (!api._instance) {
		api._instance = new ParticleApi(settings.apiUrl, {
			accessToken: settings.access_token
		}).api;
	}
	return api._instance;
}

export class CLILibraryAddCommandSite extends LibraryAddCommandSite {
	constructor(argv, apiClient) {
		super();
		this._apiClient = apiClient;
		[this.name, this.version='latest'] = argv.params.name.split('@');
		this.dir = argv.params.dir || process.cwd();
	}

	apiClient() {
		return this._apiClient;
	}

	libraryIdent() {
		// todo - shouldn't this be a promise?
		return {
			name: this.name,
			version: this.version
		};
	}

	projectDir() {
		return this.dir;
	}

	fetchingLibrary(promise, name) {
		return spin(promise, `Adding library ${chalk.green(name)}`);
	}

	addedLibrary(name, version) {
		return Promise.resolve().then(() => log.success(`Added library ${chalk.green(name)} ${version} to project`));
	}
}

export default ({root, factory}) => {
	const lib = factory.createCategory(root, 'library', 'Manages firmware libraries', { alias: 'libraries' });

	libraryInit({root, lib, factory});
	libraryInstall({lib, factory, apiJS: api()});
	libraryMigrate({lib, factory});
	librarySearch({lib, factory, apiJS: api()});
	libraryPublish({lib, factory, apiJS: api()});
	libraryDelete({lib, factory, apiJS: api()});

	factory.createCommand(lib, 'add', 'Add a library to the current project.', {
		options: {},
		params: '<name>',

		handler: function libraryAddHandler(argv) {
			// todo ... and here
			const site = new CLILibraryAddCommandSite(argv, buildAPIClient(api()));
			const cmd = new LibraryAddCommand();
			return site.run(cmd);
		}
	});
	return lib;
};
