const chalk = require('chalk');
const log = require('../lib/log');
const { spin } = require('../app/ui');
const { buildAPIClient } = require('./apiclient');
const { LibraryContributeCommand } = require('../cmd');
const { CLILibraryContributeCommandSite } = require('./library_upload');
const { LibraryPublishCommand, LibraryPublishCommandSite } = require('../cmd');


class CLILibraryPublishCommandSite extends LibraryPublishCommandSite {

	constructor(argv, apiClient){
		super();
		this.argv = argv;
		this.ident = argv.params.name;
		this._apiClient = apiClient;
	}

	libraryIdent(){
		return this.ident;
	}

	libraryDirectory(){
		return this.dir;
	}

	apiClient(){
		return this._apiClient;
	}

	error(error){
		throw error;
	}

	publishingLibrary(promise, ident){
		return spin(promise, `Publishing library ${chalk.green(ident)}`);
	}

	publishLibraryComplete(library){
		return log.success(`Library ${chalk.green(library.name)} was successfully published.`);
	}
}

class CLILibraryPublishContributeCommandSite extends CLILibraryContributeCommandSite {

	/**
	 * Saves the constributed library and doesn't output a contributed success message since
	 * the publish steps comes immediately afterwards - only want to print success when all steps
	 * are complete.
	 * @param {Library} library   The library that was contributed.
	 */
	contributeComplete(library){
		this.contributedLibrary = library;
	}
}


module.exports.CLILibraryPublishCommandSite = CLILibraryPublishCommandSite;
module.exports.command = async (apiJS, argv) => {
	const site = new CLILibraryPublishCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibraryPublishCommand();

	if (!site.libraryIdent()){
		// no library name given - try publishing the current library
		const contributeSite = new CLILibraryPublishContributeCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
		// todo - set more stringent validation on the contribute command since this is pre-publish
		const contribute = new LibraryContributeCommand();
		await contributeSite.run(contribute);
		site.ident = contributeSite.contributedLibrary.name;
	}
	return site.run(cmd);
};

