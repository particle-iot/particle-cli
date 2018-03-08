import { LibrarySearchCommandSite, LibrarySearchCommand } from '../cmd';
import { spin } from '../app/ui';
import log from '../lib/log';
import chalk from 'chalk';
import { buildAPIClient } from './apiclient';
import { formatLibrary } from './library_ui.js';


export class CLILibrarySearchCommandSite extends LibrarySearchCommandSite {

	constructor(argv, apiClient) {
		super();
		this._apiClient = apiClient;
		this.argv = argv;
	}

	searchString() {
		return this.argv.params.name;
	}

	apiClient() {
		return this._apiClient;
	}

	notifyListLibrariesStart(promise, filter) {
		return spin(promise, `Searching for libraries matching ${chalk.green(filter)}`);
	}

	notifyListLibrariesComplete(promise, filter, libraries, error) {
		if (error) {
			log.error(error);
		} else {
			const count = libraries ? libraries.length : 0;
			const library = count===1 ? 'library' : 'libraries';
			log.success(`Found ${count} ${library} matching ${chalk.green(filter)}`);
			for (let idx in libraries) {
				const lib = libraries[idx];
				console.log(formatLibrary(lib));
			}
		}
	}
}

export function command(apiJS, argv) {
	const site = new CLILibrarySearchCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibrarySearchCommand();
	return site.run(cmd);
}
