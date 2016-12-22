import {LibraryAddCommand, LibraryAddCommandSite} from '../cmd';
import chalk from 'chalk';
import log from '../app/log';
import {spin} from '../app/ui';
import {buildAPIClient} from './apiclient';

class CLILibraryAddCommandSite extends LibraryAddCommandSite {
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
		return Promise.resolve().then(() => {
			log.success(`Library ${chalk.green(name)} ${version} has been added to the project.`);
//			log.success(`To get started using this library, run ${chalk.bold('particle library view '+name)} to see usage examples.`);
		});
	}
}


export function command(apiJS, argv) {
	const site = new CLILibraryAddCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibraryAddCommand();
	return site.run(cmd);
}
