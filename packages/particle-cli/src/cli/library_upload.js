const chalk = require('chalk');
const log = require('../lib/log');
const { spin } = require('../app/ui');
const { convertApiError } = require('../cmd/api');
const { buildAPIClient } = require('./apiclient');
const { LibraryContributeCommand, LibraryContributeCommandSite } = require('../cmd');


class CLILibraryContributeCommandSite extends LibraryContributeCommandSite {
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


module.exports.CLILibraryContributeCommandSite = CLILibraryContributeCommandSite;
module.exports.command = (apiJS, argv) => {
	const site = new CLILibraryContributeCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
	const cmd = new LibraryContributeCommand();
	return site.run(cmd);
};

