import {ProjectInitCommand, ProjectInitCommandSite} from '../cmd';

import log from '../app/log';
import chalk from 'chalk';

class CLIProjectInitCommandSite extends ProjectInitCommandSite {
	constructor(dir) {
		super();
		this.dir = dir;
	}

	directory() {
		return this.dir;
	}

	filesystem() {
		return require('fs');
	}

	/**
	 * Notification that the directory exists, should creation proceed?
	 * @param {String} dir The directory that exists.
	 * @returns {boolean} true to continue with project creation
	 * The response can be a direct value or a promise. If the promise is falsey then the process is stopped.
	 */
	notifyDirectoryExists(dir) {
		// creating a new project is non-destructive so we allow it always
		return true;
	}

	/**
	 * Notification of the entire project creation operation.
	 * @param {String} path      The directory that will contain the project
	 * @param {Promise} promise   The promise to create the project in the given directory
	 */
	notifyCreatingProject(path, promise) {
		return log.info(`Initializing project in directory ${chalk.bold(path)}...`);
	}

	/**
	 * Notification that the command is creating a file or directory.
	 * @param {String} path          The path being created
	 * @param {Promise} promise       The promise to create the path. The implementation may
	 * extend this promise and return the new extension. This may be undefined also.
	 * @return {Promise} undefined to use the original promise, or a wrapped version of the promise.
	 */
	notifyCreatingPath(path, promise) {
		return promise;
	}


	notifyProjectNotCreated(directory) {
		log.warn('Project initialization was cancelled.');
	}

	notifyProjectCreated(directory) {
		log.success(`A new project has been initialized in directory ${chalk.bold(directory)}`);
	}

}


export default ({project, factory}) => {

	// todo - move library add to its own module
	factory.createCommand(project, 'init', 'Initialize a new project in the current or specified directory.', {
		options: {},
		params: '[dir]',

		handler: function projectInitandler(argv) {
			const dir = argv.params.dir || process.cwd();
			const site = new CLIProjectInitCommandSite(dir);
			const cmd = new ProjectInitCommand();
			return site.run(cmd);
		}
	});
};
