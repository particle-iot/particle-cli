import { LibraryInstallCommand, LibraryInstallCommandSite } from '../cmd';
import { convertApiError } from '../cmd/api';
import chalk from 'chalk';
import { buildAPIClient } from './apiclient';

export class CLILibraryInstallCommandSite extends LibraryInstallCommandSite {

	constructor(argv, dir, apiClient) {
		super();
		this._apiClient = apiClient;
		this.argv = argv;
		this.dir = dir;
	}

	apiClient() {
		return this._apiClient;
	}

	isVendored() {
		return this.argv.vendored;
	}

	isAdaptersRequired() {
		return this.argv.adapter;
	}

	libraryName() {
		const params = this.argv.params;
		return params && params.name;
	}

	targetDirectory() {
		return this.dir;
	}

	homePathOverride() {
		return this.argv.dest;
	}

	error(error) {
		throw convertApiError(error);
	}

	notifyIncorrectLayout(actualLayout, expectedLayout, libName, targetDir) {
		return this.promiseLog(`Cannot install library: directory '${targetDir}' is a '${actualLayout}' format project, please change to a '${expectedLayout}' format.`);
	}

	notifyCheckingLibrary(libName) {
		return this.promiseLog(`Checking library ${chalk.green(libName)}...`);
	}

	notifyFetchingLibrary(lib, targetDir) {
		const dest = ` to ${targetDir}`;
		return this.promiseLog(`Installing library ${chalk.blue(lib.name)} ${lib.version}${dest} ...`);
	}

	notifyInstalledLibrary(lib, targetDir) {
		return this.promiseLog(`Library ${chalk.blue(lib.name)} ${lib.version} installed.`);
	}

	promiseLog(msg) {
		return Promise.resolve().then(() => console.log(msg));
	}
}

function install(executor, argv, apiJS) {
	const site = new CLILibraryInstallCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
	const cmd = new LibraryInstallCommand();
	return executor.run(site, cmd);
}

function copy(executor, argv, apiJS) {
	argv.vendored = true;
	argv.adapter = false;
	argv.confirm = false;
	return install(executor, argv, apiJS);
}

export function command(executor, cmd, apiJS, argv) {
	if (cmd==='copy') {
		return copy(executor, argv, apiJS);
	} else if (cmd==='install') {
		return install(executor, argv, apiJS);
	} else {
		throw Error('uknown command '+cmd);
	}
}
