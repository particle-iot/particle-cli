import {Command, CommandSite} from './command';
import {LibraryInitGenerator} from 'particle-cli-library-manager';

const promisify = require('es6-promisify');

/**
 * Specification and base implementation for the site instance expected by
 * the LibraryInitCommand.
 */
export class LibraryInitCommandSite extends CommandSite {

	constructor() {
		super();
	}

	yeomanAdapter() {
		throw new Error('not implemented');
	}

	yeomanEnvironment() {
		throw new Error('not implemented');
	}

	options() {
		return {};
	}

	args() {
		return [];
	}

}

/**
 * Implements the library initialization command.
 */
export class LibraryInitCommand extends Command {

	/**
	 *
	 * @param {object} state The current conversation state.
	 * @param {LibraryInitCommandSite} site external services.
	 * @returns {Promise} To run the library initialization command.
	 */
	run(state, site) {
		const yeoman = site.yeomanEnvironment();
		// todo - get args/options from the site
		const args = site.args();
		const opts = site.options();
		const env = yeoman.createEnv(args, opts, site.yeomanAdapter());
		env.registerStub(LibraryInitGenerator, 'library:init');
		const run = promisify((...args) => env.run(...args));
		return run(['library:init'], opts);
	}
}

