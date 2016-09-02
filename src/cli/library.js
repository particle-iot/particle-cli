import {LibraryAddCommand, LibraryAddCommandSite} from '../cmd/library';
import ParticleApi from '../cmd/api';
import settings from '../../settings';

import chalk from 'chalk';
import log from '../app/log';
import {spin} from '../app/ui';

import libraryInstall from './library_install';
import libraryMigrate from './library_migrate';
import libraryInit from './library_init';

//const ui = require('../cli/ui');

let apiJS;


export class CLILibraryAddCommandSite extends LibraryAddCommandSite {
	constructor(argv) {
		super();
		[this.name, this.version='latest'] = argv.params.name.split('@');
		this.dir = argv.params.dir || process.cwd();
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
	apiJS = new ParticleApi(settings.apiUrl, {
		accessToken: settings.access_token
	}).api;

	const lib = factory.createCategory(root, 'library', 'Manages firmware libraries', { alias: 'libraries' });

	libraryInit({root, lib, factory});
	libraryInstall({lib, factory});
	libraryMigrate({lib, factory});

	factory.createCommand(lib, 'add', 'Add a library to the current project.', {
		options: {},
		params: '<name>',

		handler: function libraryAddHandler(argv) {
			const apiClient = apiJS.client({ auth: settings.access_token });
			const site = new CLILibraryAddCommandSite(argv);
			const cmd = new LibraryAddCommand({ apiClient });
			return site.run(cmd);
		}
	});
	return lib;
};
