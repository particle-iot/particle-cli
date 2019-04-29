const chalk = require('chalk');
const { spin } = require('../app/ui');
const log = require('../lib/log');
const { buildAPIClient } = require('./apiclient');
const { LibraryDeleteCommandSite, LibraryDeleteCommand } = require('../cmd');


class CLILibraryDeleteCommandSite extends LibraryDeleteCommandSite {

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

module.exports.CLILibraryDeleteCommandSite = CLILibraryDeleteCommandSite;
module.exports.command = (apiJS, argv) => {
	const site = new CLILibraryDeleteCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibraryDeleteCommand();
	return site.run(cmd);
};

