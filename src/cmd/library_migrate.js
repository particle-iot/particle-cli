import {Command, CommandSite} from './command';

import {FileSystemLibraryRepository, FileSystemNamingStrategy} from 'particle-cli-library-manager';
import path from 'path';
import when from 'when';
import pipeline from 'when/pipeline';
import {buildAdapters} from './library_install';

export class LibraryMigrateCommandSite extends CommandSite {

	/**
	 * Provides the list of library directories to process.
	 * Can return a value or a promise.
	 */
	getLibraries() {}

	/**
	 * Notify that the given library is being migrated.
	 * @param {string} dir The directory containing the library
	 */
	notifyStart(dir) {}

	/**
	 *
	 * @param {string}  lib The directory containing the library that migration was attempted on.
	 * @param {object}  result  There result of the migration.
	 * @param {object}  err if defined, is the error that occurred migrating the library.
	 */
	notifyEnd(lib, result, err) {}

	isAdaptersRequired() {
		return false;
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
		const libsPromise = Promise.resolve(site.getLibraries());
		return when.map(libsPromise, libdir => {
			return Promise.resolve(site.notifyStart(libdir))
			.then(() => {
				const dir = path.resolve(libdir);
				const repo = new FileSystemLibraryRepository(dir, FileSystemNamingStrategy.DIRECT);
				return this.processLibrary(repo, '', state, site, libdir)
				.then(([res, err]) => {
					return Promise.resolve(site.notifyEnd(libdir, res, err))
					.then(() => {
						return {libdir, res, err};
					});
				});
			});
		});
	}

	/**
	 * Handle migration of a single library.
	 * @param repo          The filesystem repo containing the library.
	 * @param libname       The identifier of the library
	 * @param state         the current command state
	 * @param site          the command site
	 */
	processLibrary(repo, libname, state, site) {}
}

function resultError(promise) {
	return promise
		.then(result => [result, null])
		.catch(err => [null, err]);
}

export class LibraryMigrateTestCommand extends AbstractLibraryMigrateCommand {

	processLibrary(repo, libname, state, site, libdir) {
		return resultError(repo.getLibraryLayout(libname));
	}
}

export class LibraryMigrateCommand extends AbstractLibraryMigrateCommand {

	processLibrary(repo, libname, state, site, libdir) {
		return resultError(pipeline([
			() => repo.getLibraryLayout(libname),
			(layout) => {
				if (layout === 2) {
					return false;
				} else {
					return repo.setLibraryLayout(libname, 2)
						.then(() => {
							if (site.isAdaptersRequired()) {
								return buildAdapters(libdir, libname);
							}
						})
						.then(() => true);
				}
			}
		]));
	}
}
