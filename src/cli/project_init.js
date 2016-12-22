import {ProjectInitCommand, ProjectInitCommandSite, Projects} from '../cmd';
import {validateField} from 'particle-library-manager';
import path from 'path';
import log from '../app/log';
import chalk from 'chalk';
import prompt from '../../oldlib/prompts';


// todo - this is pulled from validating_editor in particle-dev-libraries. Please refactor/DRY.

function validationMessage(validationResult, fieldName) {
	return fieldName+' '+validationResult.errors[fieldName];
}

function fieldValidator(fieldName) {
	const validator = (value) => {
		const result = validateField(fieldName, value);
		return (result && result.valid) ?
			'' : validationMessage(result, fieldName);
	};
	return validator;
}

function yesNoValidator() {
	const validator = (value) => {
		if (!value || (value!=='Y' && value!=='y' && value!=='N' && value!=='n')) {
			return 'Please answer "y" or "n" - you typed '+value;
		}
	};
	return validator;
}


class CLIProjectInitCommandSite extends ProjectInitCommandSite {
	constructor({name, directory}) {
		super();
		this._name = name;
		this._dir = directory;
	}

	/**
	 * Has a dialog with the user. Returns a truthy value if project init should continue.
	 * “What would you like to call your project?”
	 Then, you are asked to choose where you would like to save your project
	 “Would you like to create your project in the default project directory? (Y/n)
	 If you answer Y, the project directory is created under /home/particle/projects/myproject, and the CLI replies, “A new project named “myproject” was successfully created in home/particle/projects/myproject
	 Then, you are automatically taken to the new project directory in your current session
	 If you answer N to the first question, the CLI asks, “Would you like to create your project in <current path>? Type “n” to cancel. (Y/n)
	 If you answer Y, the project directory is created under <current path>/myproject
	 If you answer anything else, the `project init` process is cancelled

	 */
	dialog() {
		const promptForName = () => {
			return this._name || this.prompt('What would you like to call your project? [myproject]', 'myproject', fieldValidator('name'));
		};

		function isYes(result) {
			return (result||'').toLowerCase()==='y';
		}

		const promptForLocation = (commonLocation, currentLocation) => {
			return this._dir ||
				this.prompt('Would you like to create your project in the default project directory? [Y/n]', 'Y', yesNoValidator())
					.then(result => {
						if (isYes(result)) {
							return commonLocation;
						}
					})
					.then(location => {
						return location || this.prompt(`Would you like to create your project in ${chalk.bold(currentLocation)}? Type “n” to cancel. [Y/n]`, 'Y', yesNoValidator())
							.then((result) => {
								return (isYes(result)) ? currentLocation : '';
							});
					});
		};

		return Promise.resolve()
			.then(() => promptForName())
			.then((name) => {
				this._name = name;
				if (name) {
					return promptForLocation(new Projects().myProjectsFolder(), process.cwd());
				}
			})
			.then(directory => {
				this._dir = directory;
				return this._dir && this._name;   // are we ready?
			});
	}

	/**
	 * Prompts the user to enter a value
	 * @param {string} message       The message to prompt with
	 * @param {string} value         The default value
     * @param {function(value)}         validator The validator that is used to validate the response.
	 */
	prompt(message, value, validator) {
		return prompt.promptAndValidate(message, value, validator);
	}

	name() {
		return this._name;
	}

	directory() {
		return path.join(this._dir, this._name);
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
	 * @returns {Promise} Promise
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
	factory.createCommand(project, 'create', 'Create a new project in the current or specified directory.', {
		options: {
			'name' : {
				required: false,
				description: 'provide a name for the project'
			}
		},
		params: '[dir]',

		handler: function projectInitandler(argv) {
			const dir = argv.params.dir || process.cwd();
			const site = new CLIProjectInitCommandSite(dir);
			const cmd = new ProjectInitCommand();
			return site.dialog()
				.then((ready) => {
					if (ready) {
						return site.run(cmd);
					}
				});
		}
	});
};
