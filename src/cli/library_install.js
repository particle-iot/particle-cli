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

function libraryInstallHandler(argv, apiJS) {
	const site = new CLILibraryInstallCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
	const cmd = new LibraryInstallCommand();
	return site.run(cmd);
}

export default ({lib, factory, apiJS}) => {
	factory.createCommand(lib, 'install', false, {
		options: {
			'copy': {
				required: false,
				boolean: true,
				alias: 'vendored',
				description: 'install the library by copying the library sources into the project\'s lib folder.'
			},
			'adapter': {        // hidden
				required: false,
				boolean: true,
				alias: 'a'
			},
			'confirm': {
				required: false,
				boolean: true,
				alias: 'y'
			},
			'dest': {
				required: false,
				boolean: false,
				description: 'the directory to install to'
			}
		},
		params: '[name]',
		handler: (argv) => libraryInstallHandler(argv, apiJS),
	});

	factory.createCommand(lib, 'copy', 'Copies a library to the current project', {
		options: {},
		params: '[name]',
		handler: function LibraryCopyHandler(argv) {
			argv.vendored = true;
			argv.adapter = false;
			argv.confirm = false;
			return libraryInstallHandler(argv, apiJS);
		}
	});
};
