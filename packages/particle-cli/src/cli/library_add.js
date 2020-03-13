const chalk = require('chalk');
const log = require('../lib/log');
const { spin } = require('../app/ui');
const { buildAPIClient } = require('./apiclient');
const { LibraryAddCommand, LibraryAddCommandSite } = require('../cmd');


class CLILibraryAddCommandSite extends LibraryAddCommandSite {
	constructor(argv, apiClient){
		super();
		this._apiClient = apiClient;
		[this.name, this.version='latest'] = argv.params.name.split('@');
		this.dir = argv.params.dir || process.cwd();
	}

	apiClient(){
		return this._apiClient;
	}

	libraryIdent(){
		// todo - shouldn't this be a promise?
		return {
			name: this.name,
			version: this.version
		};
	}

	projectDir(){
		return this.dir;
	}

	fetchingLibrary(promise, name){
		return spin(promise, `Adding library ${chalk.blue(name)}`);
	}

	async addedLibrary(name, version){
		log.success(`Library ${chalk.blue(name)} ${version} has been added to the project.`);
		log.success(`To get started using this library, run ${chalk.bold('particle library view '+name)} to view the library documentation and sources.`);
	}
}


module.exports.command = (apiJS, argv) => {
	const site = new CLILibraryAddCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibraryAddCommand();
	return site.run(cmd);
};

