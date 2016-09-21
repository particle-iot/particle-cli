import {LibraryPublishCommand, LibraryPublishCommandSite} from '../cmd/library_publish';
import {convertApiError} from '../cmd/api';
const settings = require('../../settings');

import chalk from 'chalk';
import log from '../app/log';
import {spin} from '../app/ui';

export function buildAPIClient(apiJS) {
	return apiJS.client({ auth: settings.access_token });
}

export class CLILibraryPublishCommandSite extends LibraryPublishCommandSite {

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
		return spin(promise, `Validating library at ${chalk.green(directory)}`);
	}

	publishingLibrary(promise, library) {
		return spin(promise, `Publishing library ${chalk.green(library.name)}`);
	}

	publishComplete(library) {
		return log.success(`Library ${chalk.green(library.name)} was successfully published.\n` +
		`Add it to your project with ${chalk.green('particle library add ' + library.name)}`);
	}
}

export default ({lib, factory, apiJS}) => {
	factory.createCommand(lib, 'publish', 'publishes a library', {
		options: {
			'dryRun': {
				required: false,
				boolean: true,
				description: 'perform validation steps but don\'t actually publish the library.'
			}
		},
		handler: function LibraryPublishHandler(argv) {
			const site = new CLILibraryPublishCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
			const cmd = new LibraryPublishCommand();
			return site.run(cmd);
		}
	});
};
