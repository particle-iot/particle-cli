
import ProjectProperties from './project_properties';
import pipeline from 'when/pipeline';
import {convertApiError} from './api';
import {CommandSite} from './command';


export class LibraryAddCommandSite extends CommandSite {

	projectDir() {
		throw new Error('not implemented');
	}

	libraryIdent() {
		throw new Error('not implemented');
	}

	/**
	 * Notifies the site that the command is about to retrieve the libraries.
	 * @param promise   The command to retrieve the libraries.
	 * @param filter
	 * @return promse, or an extension of that promise. Return a falsey value
	 *
	 */
	notifyListLibrariesStart(promise, filter) {
		return promise;
	}

	notifyListLibrariesComplete(promise, filter, libraries, error) {

	}


	fetchingLibrary(promise, name) {
		return promise;
	}

	addedLibrary(name, version) {
	}
}


/** Library add **/
export class LibraryAddCommand {
	constructor({ apiClient } = {}) {
		this.apiClient = apiClient;
	}

	/**
	 * A request to list the libraries using the given filter.
	 * @param {string} filter a filter for the library name
	 * @returns {Promise} to fetch the libraries.
	 *
	 * The site methods notifyListLibrariesStart/notifyListLibrariesComplete are called
	 * at the start and end of the operation. 
	 */
	listLibraries(site, filter) {
		this.site = site;
		const listPromise = this.apiClient.libraries({ filter })
			.catch(err => {
				const result = this.apiError(err);
				throw result;
			});

		return Promise.resolve(this.site.notifyListLibrariesStart(listPromise, filter)
			.then(libraries => {
				this.site.notifyListLibrariesComplete(listPromise, filter, libraries, null);
				return libraries;
			})
			.catch(err => {
				this.site.notifyListLibrariesComplete(listPromise, filter, null, err);
				throw err;
			}));
	}

	/**
	 * @param {LibraryAddCommandSite} site Provides the parameters for the command.
	 */
	run(state, site) {
		this.site = site;
		this.projectProperties = new ProjectProperties(this.site.projectDir());
		const lib = site.libraryIdent();
		if (lib.version===undefined) {
			lib.version = 'latest';
		}
		return pipeline([
			() => this.ensureProjectExists(),
			() => this.loadProject(),
			() => this.fetchLibrary(lib.name, lib.version),
			(library) => this.addLibraryToProject(library),
			() => this.saveProject()
		]);
	}

	ensureProjectExists() {
		return this.projectExist().then(exists => {
			if (!exists) {
				return this.createProject();
			}
		});
	}

	projectExist() {
		return this.projectProperties.exists();
	}

	createProject() {
		// save a blank project.properties
		return this.projectProperties.save();
	}

	loadProject() {
		return this.projectProperties.load();
	}

	fetchLibrary(name, version) {
		return Promise.resolve(this.site.fetchingLibrary(this.apiClient.library(name, { version }), name, version))
		.catch(err => {
			throw this.apiError(err);
		});
	}

	apiError(err) {
		return convertApiError(err);
	}

	addLibraryToProject(library) {
		return pipeline([
			() => this.site.addedLibrary(library.name, library.version),
			() => this.projectProperties.addDependency(library.name, library.version)
		]);
	}

	saveProject() {
		return this.projectProperties.save();
	}
}
