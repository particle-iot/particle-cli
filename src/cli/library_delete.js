import settings from '../../settings';
import {LibraryDeleteCommandSite, LibraryDeleteCommand} from '../cmd';
import {spin} from '../app/ui';
import log from '../app/log';
import chalk from 'chalk';
import {buildAPIClient} from './library_search';

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
			log.error(error);
		} else {
			log.success(`Library ${chalk.green(library)} deleted.`);
		}
	}
}


export default ({lib, factory, apiJS}) => {
	factory.createCommand(lib, 'delete', false, {
		options: {
		},
		params: '<name>',
		// todo - this is a common pattern for commands, perhaps build a factory for creating a command, a site and running it.
		handler: function LibraryDeleteHandler(argv) {
			const site = new CLILibraryDeleteCommandSite(argv, buildAPIClient(apiJS));
			const cmd = new LibraryDeleteCommand();
			return site.run(cmd);
		}
	});
};
