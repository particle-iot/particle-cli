import { LibraryContributeCommand, LibraryContributeCommandSite } from '../cmd';
import { convertApiError } from '../cmd/api';
import chalk from 'chalk';
import log from '../app/log';
import { spin } from '../app/ui';
import { buildAPIClient } from './apiclient';

export class CLILibraryContributeCommandSite extends LibraryContributeCommandSite {

	constructor(argv, dir, apiClient) {
		super();
		this.argv = argv;
		this.dir = dir;
		this._apiClient = apiClient;
	}

	libraryDirectory() {
		return this.dir;
	}

	apiClient() {
		return this._apiClient;
	}

	dryRun() {
		return this.argv.dryRun;
	}

	error(error) {
		throw convertApiError(error);
	}

	validatingLibrary(promise, directory) {
		return spin(promise, `Validating library at ${chalk.bold(directory)}`);
	}

	contributingLibrary(promise, library) {
		return spin(promise, `Uploading library ${chalk.green(library.name)}`);
	}

	contributeComplete(library) {
		return log.success(`Library ${chalk.green(library.name)} was successfully uploaded.\n` +
		`Add it to your project with ${chalk.bold('particle library add ' + library.name)}`);
	}
}

export function command(executor, apiJS, argv) {
	const site = new CLILibraryContributeCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
	const cmd = new LibraryContributeCommand();
	return executor.run(site, cmd);
}
