import {Command, CommandSite} from './command';

import {FileSystemLibraryRepository} from 'particle-cli-library-manager';
const path = require('path');

export class LibraryMigrateCommandSite extends CommandSite {

	/**
	 * Provides the list of library directories to process.
	 */
	getLibraries() {}

	notifyStart(lib) {}
	notifyEnd(lib, result, err) {}
}


class AbstractLibraryMigrateCommand extends Command {
	/**
	 *
	 * @param {object} state
	 * @param {LibraryMigrateCommandSite} site
	 */
	async run(state, site) {
		const libs = await site.getLibraries();
		for (let libdir of libs) {
			site.notifyStart(libdir);
			const dir = path.resolve(libdir);
			const parent = path.resolve(path.join(dir, '..'));
			const libname = path.basename(dir);
			const repo = new FileSystemLibraryRepository(parent);
			const [result,err] = await this.processLibrary(repo, libname, state, site);
			site.notifyEnd(libdir, result, err);
		}
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
			// todo - only cature and report library errors
			// other errors should be propagated and abort the command
			err = e;
		}
		return [result, err];
	}
}
