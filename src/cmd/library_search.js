import {Command, CommandSite} from './command';
import {convertApiError} from './api';

/**
 * Specification and base implementation for the site instance expected by
 * the LibrarySearchCommand.
 */
export class LibrarySearchCommandSite extends CommandSite {

	constructor() {
		super();
	}

	apiClient() {
		throw new Error('apiClient not available');
	}

	searchString() {
		throw new Error('search string not available');
	}

	/**
	 * Notifies the site that the command is about to retrieve the libraries.
	 * @param {Promise}promise   The command to retrieve the libraries.
	 * @param {string}filter     Optional
	 * @return {Promise} to list libraries
	 */
	notifyListLibrariesStart(promise, filter) {
		return promise;
	}

	notifyListLibrariesComplete(promise, filter, libraries, error) {
		if (error) {
			throw error;
		}
	}

}

/**
 * Implements the library search command.
 */
export class LibrarySearchCommand extends Command {

	/**
	 * A request to list the libraries using the given filter.
	 * @param {LibraryAddCommandSite} site Provides the parameters for the command
	 * @param {string} filter a filter for the library name
	 * @returns {Promise} to fetch the libraries.
	 *
	 * The site methods notifyListLibrariesStart/notifyListLibrariesComplete are called
	 * at the start and end of the operation.
	 */
	listLibraries(site, filter) {
		this.site = site;

		return Promise.resolve(this.site.apiClient()).then((apiClient) => {
			const listPromise = apiClient.libraries({ filter })
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
		});
	}

	apiError(err) {
		return convertApiError(err);
	}

	/**
	 *
	 * @param {object} state The current conversation state.
	 * @param {LibrarySearchCommandSite} site external services.
	 * @returns {Promise} To run the library search command.
	 */
	run(state, site) {
		return Promise.resolve(site.searchString())
		.then(filter => {
			return this.listLibraries(site, filter);
		});
	}

}

