
import ProjectProperties from './project_properties';
import pipeline from 'when/pipeline';
import {convertApiError} from './api';
import {CommandSite} from './command';


export class LibraryAddCommandSite extends CommandSite {

	apiClient() {
		throw new Error('not implemented');
	}

	projectDir() {
		throw new Error('not implemented');
	}

	libraryIdent() {
		throw new Error('not implemented');
	}

	fetchingLibrary(promise, name) {
		return promise;
	}

	addedLibrary(name, version) {
	}
}


/** Library add **/
export class LibraryAddCommand {

	/**
	 * @param {Object} state Unused
	 * @param {LibraryAddCommandSite} site Provides the parameters for the command.
	 * @returns {Promise} Library add process
	 */
	run(state, site) {
		this.site = site;
		this.projectProperties = new ProjectProperties(this.site.projectDir());
		const lib = site.libraryIdent();
		if (lib.version === undefined) {
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

		return Promise.resolve(this.site.apiClient())
		.then((apiClient) => {
			return Promise.resolve(this.site.fetchingLibrary(apiClient.library(name, { version }), name, version));
		})
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
