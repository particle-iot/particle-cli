import {LibraryMigrateCommandSite, LibraryMigrateTestCommand, LibraryMigrateCommand} from '../lib/library';

//const ui = require('../cli/ui');

class CLIBaseLibraryMigrateCommandSite extends LibraryMigrateCommandSite {
	constructor(argv, defaultDir) {
		super();
		this.argv = argv;
		if (!argv.params.library) {
			argv.params.library = [defaultDir];
		}
		this.libraries = argv.params.library;
	}

	getLibraries() {
		return this.libraries;
	}

	handleError(lib, err) {
		if (err.name=='LibraryNotFoundError') {
			console.error('No valid library found in '+lib);
		} else {
			console.error(`Error processing library '${lib}': ${err}`);
		}
	}
}

class CLILibraryTestMigrateCommandSite extends CLIBaseLibraryMigrateCommandSite {

	notifyEnd(lib, result, err) {
		if (err) {
			this.handleError(err);
		} else {
			if (result===1) {
				console.info(`Library can be migrated: '${lib}'`);
			} else {
				console.info(`Library already migrated: '${lib}'`);
			}
		}
	}
}

class CLILibraryMigrateCommandSite extends CLIBaseLibraryMigrateCommandSite {
	notifyEnd(lib, result, err) {
		if (err) {
			this.handleError(lib, err);
		} else {
			if (result == true) {
				console.info(`Library migrated to v2 format: '${lib}'`);
			} else {
				console.info(`Library already in v2 format: '${lib}'`);
			}
		}
	}
}

export default (app, cli) => {
	const lib = cli.createCategory(app, 'library', 'Manages firmware libraries');
	cli.createCommand(lib, 'migrate', 'Migrates a local library from v1 to v2 format.', {
		options: {
			test: {
				boolean: true,
				description: 'test if the library can be migrated'
			}
		},
		params: '[library...]',

		handler: function libraryMigrateHandler(argv) {
			let site, cmd;
			if (argv.test) {
				site = CLILibraryTestMigrateCommandSite;
				cmd = LibraryMigrateTestCommand;
			}
			else {
				site = CLILibraryMigrateCommandSite;
				cmd = LibraryMigrateCommand;
			}
			site = new site(argv, process.cwd());
			cmd = new cmd();
			return site.run(cmd);
		}
	});
};
