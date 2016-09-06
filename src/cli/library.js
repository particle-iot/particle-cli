import {LibraryAddCommand, LibraryAddCommandSite} from '../cmd/library';
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
import {buildAPIClient} from './library_search';

//const ui = require('../cli/ui');

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
	// todo - Julien - how come access token needs to be specified here...
	let apiJS = new ParticleApi(settings.apiUrl, {
		accessToken: settings.access_token
	}).api;

	const lib = factory.createCategory(root, 'library', 'Manages firmware libraries', { alias: 'libraries' });

	libraryInit({root, lib, factory});
	libraryInstall({lib, factory});
	libraryMigrate({lib, factory});
	librarySearch({lib, factory, apiJS});
	libraryPublish({lib, factory, apiJS});

	factory.createCommand(lib, 'add', 'Add a library to the current project.', {
		options: {},
		params: '<name>',

		handler: function libraryAddHandler(argv) {
			// todo ... and here
			const site = new CLILibraryAddCommandSite(argv, buildAPIClient(apiJS));
			const cmd = new LibraryAddCommand();
			return site.run(cmd);
		}
	});
	return lib;
};
