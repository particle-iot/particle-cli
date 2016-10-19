import settings from '../../settings';
import {LibrarySearchCommandSite, LibrarySearchCommand} from '../cmd';
import {spin} from '../app/ui';
import log from '../app/log';
import chalk from 'chalk';

export function buildAPIClient(apiJS) {
	return apiJS.client({ auth: settings.access_token });
}


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
				const suffix = global.verboseLevel>1 ? ` - ${lib.sentence}` : '';
				const prefix = lib.visibility && lib.visibility==='private' ? '[private] ' : '';
				log.success(`${prefix}${lib.name}@${lib.version}${suffix}`);
			}
		}
	}
}


export default ({lib, factory, apiJS}) => {
	factory.createCommand(lib, 'search', 'searches available libraries', {
		options: {
		},
		params: '<name>',
		handler: function LibrarySearchHandler(argv) {
			const site = new CLILibrarySearchCommandSite(argv, buildAPIClient(apiJS));
			const cmd = new LibrarySearchCommand();
			return site.run(cmd);
		}
	});
};
