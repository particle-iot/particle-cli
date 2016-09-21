import {Command, CommandSite} from './command';
import {convertApiError} from './api';

/**
 * Specification and base implementation for the site instance expected by
 * the LibraryDeleteCommand.
 */
export class LibraryDeleteCommandSite extends CommandSite {

	constructor() {
		super();
	}

	apiClient() {
		throw new Error('apiClient not available');
	}

	libraryIdent() {
		throw new Error('search string not available');
	}

	/**
	 * Notifies the site that the command is about to retrieve the libraries.
	 * @param {Promise}promise   The command to retrieve the libraries.
	 * @param {string}filter     Optional
	 * @return {Promise} to list libraries
	 */
	notifyStart(promise, libraryIdent) {
		return promise;
	}

	notifyComplete(promise, result, error) {
		if (error) {
			throw error;
		}
	}

}

/**
 * Implements the library delete command.
 */
export class LibraryDeleteCommand extends Command {

	/**
	 * A request to delete the library matching the given name. (In future name@version might be supported too.)
	 * @param {LibraryDeleteCommandSite} site Provides the parameters for the command
	 * @returns {Promise} to delete library.
	 *
	 * The site methods notifyListLibrariesStart/notifyListLibrariesComplete are called
	 * at the start and end of the operation.
	 */
	deleteLibrary(site, name) {
		this.site = site;
		const force = process.env.PARTICLE_LIBRARY_DELETE_TOKEN;
		if (!force) {
			return Promise.reject('PARTICLE_LIBRARY_DELETE_TOKEN should be defined to enable library delete functionality.')
		}

		return Promise.resolve(this.site.apiClient()).then((apiClient) => {

			const searchPromise = apiClient.libraries({filter: name});

			const deletePromise = apiClient.deleteLibrary({ name, force });

			const promise = searchPromise
			.then(libraries => {
				if (libraries.length) {
					return deletePromise;
				}
			})
			.catch(err => {
				const result = this.apiError(err);
				throw result;
			});

			// todo - this delete command and the search command have a similar structure so try to factor out the
			// common flow.

			return Promise.resolve(this.site.notifyStart(promise, name)
				.then(() => {
					this.site.notifyComplete(promise, name, null);
				})
				.catch(err => {
					this.site.notifyComplete(promise, null, err);
					throw err;
				}));
		});
	}

	apiError(err) {
		return convertApiError(err);
	}

	/**
	 *
	 * @param {object} state The current conversation state.
	 * @param {LibraryDeleteCommandSite} site external services.
	 * @returns {Promise} To run the library delete command.
	 */
	run(state, site) {
		return Promise.resolve(site.libraryIdent())
		.then(ident => {
			return this.deleteLibrary(site, ident);
		});
	}

}

