import {Command, CommandSite} from './command';
import {CloudLibraryRepository} from 'particle-cli-library-manager';
import ProjectProperties, {extended} from './project_properties';


/**
 * Specification and base implementation for the site instance expected by
 * the LibraryInstallCommand.
 */
export class LibraryInstallCommandSite extends CommandSite {

	constructor() {
		super();
	}

	isVendored() {
		return false;
	}

	libraryName() {
		throw Error('not implemented');
	}

	/**
	 * The target directory containing the project to install the library into.
	 */
	targetDirectory() {
		throw Error('not implemented');
	}

	accessToken() {
		throw Error('not implemented');
	}

	error(err) {
		throw err;
	}

	notifyIncorrectLayout(actualLayout, expectedLayout, libName, targetDir) {
		return Promise.resolve();
	}

	notifyCheckingLibrary(libName) {
		return Promise.resolve();
	}

	notifyFetchingLibrary(lib, targetDir) {
		return Promise.resolve();
	}

	notifyInstalledLibrary(lib, targetDir) {
		return Promise.resolve();
	}
}

/**
 * Implements the library initialization command.
 */
export class LibraryInstallCommand extends Command {

	/**
	 *
	 * @param {object} state The current conversation state.
	 * @param {LibraryInstallCommandSite} site external services.
	 * @returns {Promise} To run the library install command.
	 */
	run(state, site) {
		const targetDir = site.targetDirectory();
		const libName = site.libraryName();
		const auth = site.accessToken();
		const cloudRepo = new CloudLibraryRepository({auth});
		const project = new ProjectProperties(targetDir);

		if (!libName) {
			return cloudRepo.names(names => console.log(names));
		} else {
			const libDir = project.libraryDirectory(site.isVendored(), site.libraryName());
			return project.projectLayout()
				.then((layout) => {
					if (layout!==extended) {
						return site.notifyIncorrectLayout(layout, extended, libName, targetDir);
					} else {
						return site.notifyCheckingLibrary(libName)
							.then(() => {
								return cloudRepo.fetch(libName);
							})
							.then((lib) => {
								return site.notifyFetchingLibrary(lib.metadata, targetDir).
									then(() => lib);
							})
							.then(lib => {
								return lib.copyTo(libDir);
							})
							.then(lib => site.notifyInstalledLibrary(lib.metadata, targetDir))
							.catch(err => site.error(err));
					}
				});

		}


	}
}

