import {Command, CommandSite} from './command';

import {FileSystemLibraryRepository, FileSystemNamingStrategy} from 'particle-cli-library-manager';
const path = require('path');

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
	 * @return {Array<object>} Returns an array, one index for each library processed.
	 * Each element has properties:
	 *  - libdir: the directory of the library
	 *  - result: result of running `processLibrary()` if no errors were produced.
	 *  - err: any error that was produced.
	 */
	async run(state, site) {
		const libs = await site.getLibraries();
		const result = [];
		for (let libdir of libs) {
			site.notifyStart(libdir);
			const dir = path.resolve(libdir);
			const repo = new FileSystemLibraryRepository(dir, FileSystemNamingStrategy.DIRECT);
			const [res,err] = await this.processLibrary(repo, '', state, site);
			site.notifyEnd(libdir, res, err);
			result.push({libdir, res, err});
		}
		return result;
	}
	
	processLibrary(repo, libname, state, site) {}
}

async function resultError(promise) {
	let result, err;
	try {
		result = await promise;
	} catch (e) {
		err = e;
	}
	return [result, err];
}

export class LibraryMigrateTestCommand extends AbstractLibraryMigrateCommand {

	processLibrary(repo, libname, state, site) {
		return resultError(repo.getLibraryLayout(libname));
	}
}

export class LibraryMigrateCommand extends AbstractLibraryMigrateCommand {

	async processLibrary(repo, libname, state, site) {
		let result, err;
		try {
			const layout = await repo.getLibraryLayout(libname);
			if (layout === 2) {
				result = false;
			} else {
				await repo.setLibraryLayout(libname, 2);
				result = true;
			}
		} catch (e) {
			// todo - only capture and report library errors
			// other errors should be propagated and abort the command
			err = e;
		}
		return [result, err];
	}
}
