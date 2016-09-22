import {Command, CommandSite} from './command';
import {CloudLibraryRepository, FileSystemLibraryRepository, FileSystemNamingStrategy} from 'particle-cli-library-manager';
import ProjectProperties, {extended} from './project_properties';
import path from 'path';

/**
 * Specification and base implementation for the site instance expected by
 * the LibraryInstallCommand.
 */
export class LibraryInstallCommandSite extends CommandSite {

	constructor() {
		super();
	}

	apiClient() {
		throw new Error('not implemented');
	}

	// mdm - I'm not sure about having all these methods for accessing simple properties.
	// It might be simpler to have a cmd args object with properties. It depends upon if the
	// property values need to come from the user, e.g. an interactive prompt for all the values.

	isVendored() {
		return false;
	}

	isAdaptersRequired() {
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

export function buildAdapters(libDir, libName) {
	const fsrepo = new FileSystemLibraryRepository(libDir, FileSystemNamingStrategy.DIRECT);
	return fsrepo.addAdapters(() => {}, libName, path.join(libDir, 'src'));
}

/**
 * Implements the library initialization command.
 */
export class LibraryInstallCommand extends Command {

	/**
	 * @param {object} state The current conversation state.
	 * @param {LibraryInstallCommandSite} site external services.
	 * @returns {Promise} To run the library install command.
	 */
	run(state, site) {
		const targetDir = site.targetDirectory();
		const libName = site.libraryName();
		const client = site.apiClient();
		let result;
		const project = new ProjectProperties(targetDir);
		const cloudRepo = new CloudLibraryRepository({client});
		const context = {};
		if (libName) {
			result = this.installSingleLib(site, cloudRepo, site.isVendored(), libName, undefined, targetDir, project, context);
		} else {
			result = this.installProjectLibs(site, cloudRepo, site.isVendored(), targetDir, project, context);
		}
		result = result .catch(err => site.error(err));
		return result;
	}

	installProjectLibs(site, cloudRepo, vendored, projectDir, project, context) {
		// read the project
		return project.load()
			.then(() => {
				const deps = project.groups.dependencies || {};
				const install = [];
				for (let d in deps) {
					const libName = d;
					const libVersion = deps[d];
					install.push(this.installSingleLib(site, cloudRepo, vendored, libName, libVersion, projectDir, project, context));
				}
				return Promise.all(install);
			});
	}

	_installLib(site, cloudRepo, vendored, libName, libVersion, projectDir, project, context) {
		context[libName] = libVersion || 'latest';

		const libDir = project.libraryDirectory(vendored, libName);
		return site.notifyCheckingLibrary(libName)
			.then(() => {
				// todo - this should use the correct version too
				return cloudRepo.fetch(libName);
			})
			.then((lib) => {
				return site.notifyFetchingLibrary(lib.metadata, projectDir)
					.then(() => lib.copyTo(libDir))
					.then(() => {
						if (site.isAdaptersRequired()) {
							return buildAdapters(libDir, lib.name);
						}
					})
					.then(() => site.notifyInstalledLibrary(lib.metadata, projectDir))
					.then(() => this._installDependents(site, cloudRepo, vendored, projectDir, project, context, libDir));
			})
	}

	/**
	 * Determines the dependent libraries of a given installed library and
	 * @param site
	 * @param cloudRepo
	 * @param vendored
	 * @param projectDir
	 * @param project
	 * @param context
	 * @param libDir
	 * @private
	 */
	_installDependents(site, cloudRepo, vendored, projectDir, project, context, libDir) {
		const libraryProperties = new ProjectProperties(libDir, {filename:'library.properties'});
		return libraryProperties.load()
			.then(() => {
				const resolve = [];
				const dependencies = libraryProperties.dependencies();
				for (let dependencyName in dependencies) {
					const dependencyVersion = dependencies[dependencyName];
					if (!context[dependencyName]) {
						context[dependencyName] = dependencyVersion;
						resolve.push(this._installLib(site, cloudRepo, vendored, dependencyName, dependencyVersion, projectDir, project, context))
					}
				}
				return Promise.all(resolve);
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
	installSingleLib(site, cloudRepo, vendored, libName, libVersion, projectDir, project, context) {
		return project.projectLayout()
			.then((layout) => {
				if (layout!==extended) {
					return site.notifyIncorrectLayout(layout, extended, libName, projectDir);
				} else {
					return this._installLib(site, cloudRepo, vendored, libName, libVersion, projectDir, project, context);
				}
			});
	}
}

