import { LibraryDeleteCommandSite, LibraryDeleteCommand } from '../cmd';
import { spin } from '../app/ui';
import log from '../app/log';
import chalk from 'chalk';
import { buildAPIClient } from './apiclient';

export class CLILibraryDeleteCommandSite extends LibraryDeleteCommandSite {

	constructor(argv, apiClient) {
		super();
		this._apiClient = apiClient;
		this.argv = argv;
	}

	libraryIdent() {
		return this.argv.params.name;
	}

	apiClient() {
		return this._apiClient;
	}

	notifyStart(promise, lib) {
		return spin(promise, `Deleting library ${chalk.green(lib)}...`);
	}

	notifyComplete(promise, library, error) {
		if (error) {
	// this leads to the message being printed twice
	//		log.error(error);
		} else {
			log.success(`Library ${chalk.green(library)} deleted.`);
		}
	}
}

export function command(executor, apiJS, argv) {
	const site = new CLILibraryDeleteCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibraryDeleteCommand();
	return executor.run(site, cmd);
}
