const chalk = require('chalk');
const log = require('../lib/log');
const { spin } = require('../app/ui');
const { buildAPIClient } = require('./apiclient');
const { formatLibrary } = require('./library_ui');
const { LibrarySearchCommandSite, LibrarySearchCommand } = require('../cmd');


class CLILibrarySearchCommandSite extends LibrarySearchCommandSite {
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
		const { json } = this.argv;

		if (json){
			return promise;
		}
		return spin(promise, `Searching for libraries matching ${chalk.green(filter)}`);
	}

	notifyListLibrariesComplete(promise, filter, libraries, error) {
		const { json } = this.argv;

		if (error){
			throw error;
		}

		if (json){
			const out = createJSONOutput(filter, libraries);
			return console.log(out);
		}

		const count = libraries ? libraries.length : 0;
		const library = count === 1 ? 'library' : 'libraries';
		log.success(`Found ${count} ${library} matching ${chalk.green(filter)}`);
		for (let idx in libraries) {
			const lib = libraries[idx];
			console.log(formatLibrary(lib));
		}
	}
}


module.exports.CLILibrarySearchCommandSite = CLILibrarySearchCommandSite;
module.exports.command = (apiJS, argv) => {
	const site = new CLILibrarySearchCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibrarySearchCommand();
	return site.run(cmd)
		.catch(error => {
			error.asJSON = argv.json;
			throw error;
		});
};


// UTILS //////////////////////////////////////////////////////////////////////
function createJSONOutput(filter, libraries){
	const meta = { filter };
	const out = { meta, data: libraries };
	return JSON.stringify(out, null, 4);
}

