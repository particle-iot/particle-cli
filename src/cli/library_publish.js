import {LibraryPublishCommand, LibraryPublishCommandSite} from '../cmd/library_publish';
import {convertApiError} from '../cmd/api';
const settings = require('../../settings');

import chalk from 'chalk';
import log from '../app/log';
import {spin} from '../app/ui';


export class CLILibraryPublishCommandSite extends LibraryPublishCommandSite {

	constructor(argv, dir) {
		super();
		this.argv = argv;
		this.dir = dir;
	}

	libraryDirectory() {
		return this.dir;
	}

	dryRun() {
		return this.argv.dryRun;
	}

	accessToken() {
		return settings.access_token;
	}

	error(error) {
		throw convertApiError(error);
	}

	fetchingLibrary(promise, name) {
		return spin(promise, `Adding library ${chalk.green(name)}`);
	}

	addedLibrary(name, version) {
		return Promise.resolve().then(() => log.success(`Added library ${chalk.green(name)} ${version} to project`));
	}

	validatingLibrary(directory, promise) {
		return spin(promise, `Validating library at ${chalk.green(directory)}`);
	}

	publishingLibrary(library, promise) {
		return spin(promise, `Publishing library ${chalk.green(library.name)}`);
	}

	publishComplete(library) {
		return log.success(`Library ${chalk.green(library.name)} was successfully published.`);
	}
}

export default ({lib, factory}) => {
	factory.createCommand(lib, 'publish', 'publishes a library', {
		options: {
			'dryRun': {
				required: false,
				boolean: true,
				description: 'perform validation steps but don\'t actually publish the library.'
			}
		},
		handler: function LibraryPublishHandler(argv) {
			const site = new CLILibraryPublishCommandSite(argv, process.cwd());
			const cmd = new LibraryPublishCommand();
			return site.run(cmd);
		}
	});
};
