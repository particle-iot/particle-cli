import {LibraryInstallCommand, LibraryInstallCommandSite} from '../cmd';
import {convertApiError} from '../cmd/api';
const settings = require('../../settings');
import {buildAPIClient} from './apiclient';

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
		return this.promiseLog(`Checking library '${libName}'...`);
	}

	notifyFetchingLibrary(lib, targetDir) {
		const dest = ` to ${targetDir}`;
		return this.promiseLog(`Installing library '${lib.name} ${lib.version}${dest}' ...`);
	}

	notifyInstalledLibrary(lib, targetDir) {
		return this.promiseLog(`Library '${lib.name} ${lib.version}' installed.`);
	}

	promiseLog(msg) {
		return Promise.resolve().then(() => console.log(msg));
	}
}

function install(argv, apiJS) {
	const site = new CLILibraryInstallCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
	const cmd = new LibraryInstallCommand();
	return site.run(cmd);
}

function copy(argv, apiJS) {
	argv.vendored = true;
	argv.adapter = false;
	argv.confirm = false;
	return install(argv, apiJS);
}

export function command(cmd, apiJS, argv) {
	if (cmd==='copy') {
		return copy(argv, apiJS);
 	} else {
		return copy(argv, apiJS);
	}
}
