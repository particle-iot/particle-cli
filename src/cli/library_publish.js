import {LibraryPublishCommand, LibraryPublishCommandSite} from '../cmd';
import chalk from 'chalk';
import log from '../app/log';
import {spin} from '../app/ui';
import {buildAPIClient} from './apiclient';

export class CLILibraryPublishCommandSite extends LibraryPublishCommandSite {

	constructor(argv, apiClient) {
		super();
		this.argv = argv;
		this.ident = argv.params.name;
		this._apiClient = apiClient;
	}

	libraryIdent() {
		return this.ident;
	}

	libraryDirectory() {
		return this.dir;
	}

	apiClient() {
		return this._apiClient;
	}

	error(error) {
		throw error;
	}

	publishingLibrary(promise, ident) {
		return spin(promise, `Publishing library ${chalk.green(ident)}`);
	}

	publishLibraryComplete(library) {
		return log.success(`Library ${chalk.green(library.name)} was successfully published.`);
	}
}

export function command(apiJS, argv) {
	const site = new CLILibraryPublishCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibraryPublishCommand();
	return site.run(cmd);
}
