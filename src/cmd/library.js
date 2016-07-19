import {LibraryMigrateCommandSite, LibraryMigrateTestCommand, LibraryMigrateCommand,
LibraryAddCommand} from '../lib/library';
import ParticleApi from '../lib/api';
import settings from '../../settings';

import when from 'when';
import chalk from 'chalk';
import log from '../cli/log';
import {spin} from '../cli/ui';


//const ui = require('../cli/ui');

const apiJS = new ParticleApi(settings.apiUrl, {
	accessToken: settings.access_token
}).api;
const apiClient = apiJS.client({ auth: settings.access_token });

export class CLIBaseLibraryMigrateCommandSite extends LibraryMigrateCommandSite {
	constructor(argv, defaultDir) {
		super();
		this.argv = argv;
		if (!argv.params.library || !argv.params.library.length) {
			argv.params.library = [defaultDir];
			this.cwd = true;
		}
		this.libraries = argv.params.library;
		this.result = null;
	}

	getLibraries() {
		return this.libraries;
	}

	notifyEnd(lib, data, err) {
		this.result = {lib, data, err};
	}

	handleError(lib, err) {
		if (err.name==='LibraryNotFoundError') {
			if (this.cwd) {
				console.error('No valid library found in current directory');
			} else {
				console.error('No valid library found in '+lib);
			}
		} else {
			if (this.cwd) {
				console.error(`Error processing library in current directory: ${err}`);
			} else {
				console.error(`Error processing library '${lib}': ${err}`);
			}
		}
	}
}


export class CLILibraryTestMigrateCommandSite extends CLIBaseLibraryMigrateCommandSite {

	notifyEnd(lib, result, err) {
		super.notifyEnd(lib, result, err);
		if (err) {
			this.handleError(lib, err);
		} else {
			if (result===1) {
				if (this.cwd) {
					console.info('Library can be migrated');
				} else {
					console.info(`Library can be migrated: '${lib}'`);
				}
			} else {
				if (this.cwd) {
					console.info('Library already in v2 format');
				} else {
					console.info(`Library already in v2 format: '${lib}'`);
				}
			}
		}
	}
}

export class CLILibraryMigrateCommandSite extends CLIBaseLibraryMigrateCommandSite {
	notifyEnd(lib, result, err) {
		if (err) {
			this.handleError(lib, err);
		} else {
			if (result === true) {
				console.info(`Library migrated to v2 format: '${lib}'`);
			} else {
				console.info(`Library already in v2 format: '${lib}'`);
			}
		}
	}
}

export class CLILibraryAddCommandSite {
	constructor(argv) {
		[this.name, this.version='latest'] = argv.params.name.split('@');
		this.dir = argv.params.dir || process.cwd();
	}

	run(cmd) {
		return cmd.run(this, {
			name: this.name,
			version: this.version
		});
	}

	projectDir() {
		return this.dir;
	}

	fetchingLibrary(promise, name) {
		return spin(when(promise), `Adding library ${chalk.green(name)}`);
	}

	addedLibrary(name, version) {
		log.info(`Added library ${chalk.green(name)} ${version} to project`);
		return Promise.resolve();
	}
}

export default (app, cli) => {
	const lib = cli.createCategory(app, 'library', 'Manages firmware libraries');
	cli.createCommand(lib, 'migrate', 'Migrates a local library from v1 to v2 format.', {
		options: {
			test: {
				alias: 'dryrun',
				boolean: true,
				description: 'test if the library can be migrated'
			}
		},
		params: '[library...]',

		handler: function libraryMigrateHandler(argv) {
			let Site, Cmd;
			if (argv.test) {
				Site = CLILibraryTestMigrateCommandSite;
				Cmd = LibraryMigrateTestCommand;
			} else {
				Site = CLILibraryMigrateCommandSite;
				Cmd = LibraryMigrateCommand;
			}
			const site = new Site(argv, process.cwd());
			const cmd = new Cmd();
			return site.run(cmd);
		}
	});

	cli.createCommand(lib, 'add', 'Add a library to the current project.', {
		options: {},
		params: '<name>',

		handler: function libraryAddHandler(argv) {
			const site = new CLILibraryAddCommandSite(argv);
			const cmd = new LibraryAddCommand({ apiClient });
			return site.run(cmd)
			// TODO: Remove this when the errors are properly displayed by the command runner
				.catch(error => {
					console.log(error);
				});
		}
	});
	return lib;
};
