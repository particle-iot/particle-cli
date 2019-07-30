const chalk = require('chalk');
const { buildAPIClient } = require('./apiclient');
const { convertApiError } = require('../cmd/api');
const { LibraryInstallCommand, LibraryInstallCommandSite } = require('../cmd');


class CLILibraryInstallCommandSite extends LibraryInstallCommandSite {
	constructor(argv, dir, apiClient){
		super();
		this._apiClient = apiClient;
		this.argv = argv;
		this.dir = dir;
	}

	apiClient(){
		return this._apiClient;
	}

	isVendored(){
		return this.argv.vendored;
	}

	isAdaptersRequired(){
		return this.argv.adapter;
	}

	libraryName(){
		const params = this.argv.params;
		return params && params.name;
	}

	targetDirectory(){
		return this.dir;
	}

	homePathOverride(){
		return this.argv.dest;
	}

	error(error){
		throw convertApiError(error);
	}

	async notifyIncorrectLayout(actualLayout, expectedLayout, libName, targetDir){
		return console.log(`Cannot install library: directory '${targetDir}' is a '${actualLayout}' format project, please change to a '${expectedLayout}' format.`);
	}

	async notifyCheckingLibrary(libName){
		return console.log(`Checking library ${chalk.green(libName)}...`);
	}

	async notifyFetchingLibrary(lib, targetDir){
		const dest = ` to ${targetDir}`;
		return console.log(`Installing library ${chalk.blue(lib.name)} ${lib.version}${dest} ...`);
	}

	async notifyInstalledLibrary(lib){
		return console.log(`Library ${chalk.blue(lib.name)} ${lib.version} installed.`);
	}
}

function install(argv, apiJS){
	const site = new CLILibraryInstallCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
	const cmd = new LibraryInstallCommand();
	return site.run(cmd);
}

function copy(argv, apiJS){
	argv.vendored = true;
	argv.adapter = false;
	argv.confirm = false;
	return install(argv, apiJS);
}


module.exports.CLILibraryInstallCommandSite = CLILibraryInstallCommandSite;
module.exports.command = (cmd, apiJS, argv) => {
	if (cmd === 'copy'){
		return copy(argv, apiJS);
	} else if (cmd === 'install'){
		return install(argv, apiJS);
	} else {
		throw Error('uknown command '+cmd);
	}
};

