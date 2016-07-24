import {LibraryAddCommand} from '../lib/library';
import ParticleApi from '../lib/api';
import settings from '../../settings';

import chalk from 'chalk';
import log from '../cli/log';
import {spin} from '../cli/ui';

import libraryInstall from './library_install';
import libraryMigrate from './library_migrate';
import libraryInit from './library_init';

//const ui = require('../cli/ui');

const apiJS = new ParticleApi(settings.apiUrl, {
	accessToken: settings.access_token
}).api;
const apiClient = apiJS.client({ auth: settings.access_token });


export class CLILibraryAddCommandSite {
	constructor(argv) {
		[this.name, this.version='latest'] = argv.params.name.split('@');
		this.dir = argv.params.dir || process.cwd();
	}

	run(cmd) {
		return cmd.run(this, {
			name: this.name,
			version: this.version
		});
	}

	projectDir() {
		return this.dir;
	}

	fetchingLibrary(promise, name) {
		return spin(promise, `Adding library ${chalk.green(name)}`);
	}

	addedLibrary(name, version) {
		log.info(`Added library ${chalk.green(name)} ${version} to project`);
		return Promise.resolve();
	}
}

export default (app, cli) => {
	const lib = cli.createCategory(app, 'library', 'Manages firmware libraries');

	libraryInit(lib, cli);
	libraryInstall(lib, cli);
	libraryMigrate(lib, cli);

	cli.createCommand(lib, 'add', 'Add a library to the current project.', {
		options: {},
		params: '<name>',

		handler: function libraryAddHandler(argv) {
			const site = new CLILibraryAddCommandSite(argv);
			const cmd = new LibraryAddCommand({ apiClient });
			return site.run(cmd);
		}
	});
	return lib;
};
