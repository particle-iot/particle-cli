import {Command, CommandSite} from './command';
import {LibraryPublisher, FileSystemLibraryRepository, FileSystemNamingStrategy} from 'particle-cli-library-manager';

/**
 */
export class LibraryPublishCommandSite extends CommandSite {

	constructor() {
		super();
	}

	dryRun() {
		return false;
	}

	libraryDirectory() {
		throw Error('not implemented');
	}

	accessToken() {
		throw Error('not implemented');
	}

	error(err) {
		throw err;
	}

	/**
	 * Notification that the library directory is being checked. The library is validated and then loaded.
	 */
	validatingLibrary(directory) {

	}

	/**
	 * Notification that library publishing is starting
	 * @param {Library} library   The loaded library
	 */
	publishingLibrary(library, promise) {

	}

	publishComplete(library) {

	}

}

/**
 * Implements the library public command.
 */
export class LibraryPublishCommand extends Command {

	/**
	 * @param {object} state The current conversation state.
	 * @param {LibraryPublishCommandSite} site external services.
	 * @returns {Promise} To run the library publish command.
	 */
	run(state, site) {
		const events = (event, ...args) => {
			const fn = site[event] || (() => {});
			fn(...args);
		};

		const client = {};
		const name = '';
		let dryRun = false;
		return Promise.resolve(site.libraryDirectory())
		.then(dir => {
			return Promise.resolve(site.dryRun())
				.then(d => dryRun = d)
				.then(() => site.accessToken())
				.then(token => {
					const repo = new FileSystemLibraryRepository(dir, FileSystemNamingStrategy.DIRECT);
					return repo.publish(name, client, dryRun, events);
				});
		});
	}

}

