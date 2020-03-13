const { LibraryMigrateCommandSite, LibraryMigrateTestCommand, LibraryMigrateCommand } = require('../cmd');


class CLIBaseLibraryMigrateCommandSite extends LibraryMigrateCommandSite {
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

	isAdaptersRequired() {
		return this.argv.adapter;
	}

	getLibraries() {
		return this.libraries;
	}

	notifyEnd(lib, data, err) {
		this.result = { lib, data, err };
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

class CLILibraryTestMigrateCommandSite extends CLIBaseLibraryMigrateCommandSite {
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

class CLILibraryMigrateCommandSite extends CLIBaseLibraryMigrateCommandSite {
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


module.exports.CLIBaseLibraryMigrateCommandSite = CLIBaseLibraryMigrateCommandSite;
module.exports.CLILibraryTestMigrateCommandSite = CLILibraryTestMigrateCommandSite;
module.exports.CLILibraryMigrateCommandSite = CLILibraryMigrateCommandSite;
module.exports.command = (argv) => {
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
};

