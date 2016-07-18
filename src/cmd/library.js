import {LibraryMigrateCommandSite, LibraryMigrateTestCommand, LibraryMigrateCommand,
LibraryAddCommand} from '../lib/library';

//const ui = require('../cli/ui');

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
	constructor({ dir } = {}) {
		// const [name, version='latest'] = argv.params.name.split('@');
		this.dir = dir || process.cwd();
	}

	projectDir() {
		this.dir;
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
			const site = new CLILibraryAddCommandSite();
			const cmd = new LibraryAddCommand();
			return site.run(cmd);
		}
	});
	return lib;
};
