import {Command, CommandSite} from './command';
import {CloudLibraryRepository} from 'particle-cli-library-manager';


/**
 * Specification and base implementation for the site instance expected by
 * the LibraryInstallCommand.
 */
export class LibraryInstallCommandSite extends CommandSite {

	constructor() {
		super();
	}

	libraryName() {
		throw Error('not implemented');
	}

	targetDirectory() {
		throw Error('not implemented');
	}

	accessToken() {
		throw Error('not implemented');
	}

	error(err) {
		throw err;
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
		const cloudRepo = new CloudLibraryRepository(auth);

		return cloudRepo.fetch(libName)
			.then(lib => {
				return lib.copyTo(targetDir);
			})
			.catch(err => {
				site.error(err);
			});
	}
}

