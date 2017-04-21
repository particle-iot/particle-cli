import { LibraryPublishCommand, LibraryPublishCommandSite } from '../cmd';
import { LibraryContributeCommand } from '../cmd';

import chalk from 'chalk';
import log from '../app/log';
import { spin } from '../app/ui';
import { buildAPIClient } from './apiclient';
import { CLILibraryContributeCommandSite } from './library_upload';

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

class CLILibraryPublishContributeCommandSite extends CLILibraryContributeCommandSite {

	/**
	 * Saves the constributed library and doesn't output a contributed success message since
	 * the publish steps comes immediately afterwards - only want to print success when all steps
	 * are complete.
	 * @param {Library} library   The library that was contributed.
	 */
	contributeComplete(library) {
		this.contributedLibrary = library;
	}
}


export function command(executor, apiJS, argv) {
	const site = new CLILibraryPublishCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibraryPublishCommand();
	let promise = Promise.resolve();
	if (!site.libraryIdent()) {
		// no library name given - try publishing the current library
		const contributeSite = new CLILibraryPublishContributeCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
		// todo - set more stringent validation on the contribute command since this is pre-publish
		const contribute = new LibraryContributeCommand();
		promise = contributeSite.run(contribute).then(() => {
			site.ident = contributeSite.contributedLibrary.name;
		});
	}
	return promise.then(() => executor.run(site, cmd));
}
