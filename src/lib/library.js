import {Command, CommandSite} from './command';

import {FileSystemLibraryRepository, FileSystemNamingStrategy} from 'particle-cli-library-manager';
import ProjectProperties from './ProjectProperties';
import path from 'path';
import when from 'when';
import pipeline from 'when/pipeline';

export class LibraryMigrateCommandSite extends CommandSite {

	/**
	 * Provides the list of library directories to process.
	 */
	getLibraries() {}

	notifyStart(lib) {}

	notifyEnd(lib, result, err) {

	}
}


class AbstractLibraryMigrateCommand extends Command {
	/**
	 * Executes the library command.
	 * @param {object} state Conversation state
	 * @param {LibraryMigrateCommandSite} site Conversation interface
	 * @return {Array<object>} Returns a promise for an array, one index for each library processed.
	 * Each element has properties:
	 *  - libdir: the directory of the library
	 *  - result: result of running `processLibrary()` if no errors were produced.
	 *  - err: any error that was produced.
	 */
	run(state, site) {
		const libsPromise = when().then(() => site.getLibraries());
		return when.map(libsPromise, libdir => {
			site.notifyStart(libdir);
			const dir = path.resolve(libdir);
			const repo = new FileSystemLibraryRepository(dir, FileSystemNamingStrategy.DIRECT);
			return this.processLibrary(repo, '', state, site)
			.then(([res, err]) => {
				site.notifyEnd(libdir, res, err);
				return {libdir, res, err};
			});
		});
	}

	processLibrary(repo, libname, state, site) {}
}

function resultError(promise) {
	return promise.then(
		result => [result, null],
		err => [err, null]
	);
}

export class LibraryMigrateTestCommand extends AbstractLibraryMigrateCommand {

	processLibrary(repo, libname, state, site) {
		return resultError(repo.getLibraryLayout(libname));
	}
}

export class LibraryMigrateCommand extends AbstractLibraryMigrateCommand {

	processLibrary(repo, libname, state, site) {
		return resultError(pipeline([
			() => repo.getLibraryLayout(libname),
			(layout) => {
				if (layout === 2) {
					return false;
				} else {
					return repo.setLibraryLayout(libname, 2)
					.then(() => true);
				}
			}
		]));
	}
}

/** Library add **/
export class LibraryAddCommand {
	constructor({ apiClient } = {}) {
		this.apiClient = apiClient;
	}
	run(site, { name, version = 'latest' } = {}) {
		this.site = site;
		this.projectProperties = new ProjectProperties(this.site.projectDir());
		return pipeline([
			() => this.ensureProjectExists(),
			() => this.loadProject(),
			() => this.fetchLibrary(name, version),
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
		return this.site.fetchingLibrary(this.apiClient.library(name, { version }), name);
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
