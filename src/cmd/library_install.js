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


	// mdm - I'm not sure about having all these methods for accessing simple properties.
	// It might be simpler to have a cmd args object with properties. It depends upon if the
	// property values need to come from the user, e.g. an interactive prompt for all the values.

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
		let result;
		const project = new ProjectProperties(targetDir);
		const cloudRepo = new CloudLibraryRepository({auth});

		if (libName) {
			result = this.installSingleLib(site, cloudRepo, site.isVendored(), libName, undefined, targetDir, project);
		} else {
			result = this.installProjectLibs(site, cloudRepo, site.isVendored(), targetDir, project);
		}
		return result;
	}

	installProjectLibs(site, cloudRepo, vendored, projectDir, project) {
		// read the project
		return project.load()
			.then(() => {
				const deps = project.groups.dependencies || {};
				const install = [];
				for (let d in deps) {
					const libName = d;
					const libVersion = deps[d];
					install.push(this.installSingleLib(site, cloudRepo, vendored, libName, libVersion, projectDir, project));
				}
				return Promise.all(install);
			});
	}

	/**
	 * Install a single library.
	 * @param {LibraryIntallCommandSite} site          The command site to receive install updates
	 * @param {CloudLibraryRepository} cloudRepo     The cloud repository that is used to retrieve the library.
	 * @param {bool} vendored      true if the library should be vendored.
	 * @param {string} libName       the name of the library to install
	 * @param {string} libVersion    the version of the library to install, or undefined for the latest version.
	 *          (currently unused.)
	 * @param {string} projectDir    the project directory
	 * @param {ProjectProperties}   project       the project to update
     * @returns {Promise} to install the library.
	 */
	installSingleLib(site, cloudRepo, vendored, libName, libVersion, projectDir, project) {
		const libDir = project.libraryDirectory(vendored, libName);
		return project.projectLayout()
			.then((layout) => {
				if (layout!==extended) {
					return site.notifyIncorrectLayout(layout, extended, libName, projectDir);
				} else {
					return site.notifyCheckingLibrary(libName)
						.then(() => {
							return cloudRepo.fetch(libName);
						})
						.then((lib) => {
							return site.notifyFetchingLibrary(lib.metadata, projectDir).
							then(() => lib);
						})
						.then(lib => {
							return lib.copyTo(libDir);
						})
						.then(lib => site.notifyInstalledLibrary(lib.metadata, projectDir))
						.catch(err => site.error(err));
				}
			});
	}
}

