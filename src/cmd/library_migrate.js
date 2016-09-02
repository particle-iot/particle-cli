import {Command, CommandSite} from './command';

import {FileSystemLibraryRepository, FileSystemNamingStrategy} from 'particle-cli-library-manager';
import path from 'path';
import when from 'when';
import pipeline from 'when/pipeline';

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
			// todo - should the notifications be promisable?
			return Promise.resolve(site.notifyStart(libdir)).then(() => {
				const dir = path.resolve(libdir);
				const repo = new FileSystemLibraryRepository(dir, FileSystemNamingStrategy.DIRECT);
				return this.processLibrary(repo, '', state, site)
					.then(([res, err]) => {
						return Promise.resolve(site.notifyEnd(libdir, res, err)).then(() => {
							return {libdir, res, err};
						});
					});
			});
		});
	}

	processLibrary(repo, libname, state, site) {}
}

function resultError(promise) {
	return promise.then(
		result => [result, null],
		err => [null, err]
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
