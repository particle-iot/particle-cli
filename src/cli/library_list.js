import {LibraryListCommand, LibraryListCommandSite} from '../cmd';
import {convertApiError} from '../cmd/api';
import {spin} from '../app/ui';

export class CLILibraryListCommandSite extends LibraryListCommandSite {

	constructor(argv, apiClient) {
		super();
		this._apiClient = apiClient;
		this.argv = argv;
		this.sections = argv.sections;
	}

	apiClient() {
		return this._apiClient;
	}

	error(error) {
		throw convertApiError(error);
	}

	/**
	 * Use the default settings
	 * @returns {{}}
	 */
	settings() {
		return {};
	}

	sections() {
		const result = {};
		for (let index of this.sections) {
			const section = this.sections[index];
			result[section] = {};
		}
		return result;
	}

	notifyFetchLists(promise) {
		return spin(promise, `Searching for libraries...`)
			.then((results) => {
				for (let index in this.sections) {
					const name = this.sections[index];
					const list = results[name];
					if (list) {
						this.printSection(name, list);
					}
				}
			});
	}

	printSection(name, libraries) {
		console.log(name);
		for (let library of libraries) {
			this.printLibrary(library);
		}
	}

	printLibrary(library) {
		console.log(library.name);
		console.log(library.sentence);
		console.log(library.version);
	}

}

export default ({lib, factory, apiJS}) => {
	factory.createCommand(lib, 'install', 'installs a library', {
		options: {},
		params: '[category]',
		handler: function libraryListHandler(argv) {
			const site = new CLILibraryListCommandSite(argv, buildAPIClient(apiJS));
			const cmd = new LibraryListCommand();
			return site.run(cmd);
		}
	});
};
