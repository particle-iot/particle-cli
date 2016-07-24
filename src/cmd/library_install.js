import {LibraryInstallCommand} from '../lib/library_install';
import {LibraryInstallCommandSite} from '../lib/library_install';
import * as settings from '../../settings';
import path from 'path';

class CLILibraryInstallCommandSite extends LibraryInstallCommandSite {

	CLILibraryInstallCommandSite(argv, dir) {
		this.argv = argv;

		if (!this.argv.vendored) {
			throw new Error('non-vendored library install not yet supported. Come back later.');
		}
		const relative = (this.argv.vendored) ? 'lib' : '.lib';
		this.dir = path.join(dir, relative, this.libraryName());
	}

	libraryName() {
		return this.argv.name;
	}

	targetDirectory() {
		return this.dir;
	}

	accessToken() {
		return settings.access_token;
	}
}

export default (lib, cli) => {
	cli.createCommand(lib, 'install', 'installs a library', {
		options: {
			'vendored': {
				required: false,
				description: 'install the library as the vendored library in the given directory.'
			},
		},
		params: '<name>',
		handler: function LibraryInstallHandler(argv) {
			const site = new CLILibraryInstallCommandSite(argv, process.cwd());
			const cmd = new LibraryInstallCommand();
			return site.run(cmd);
		}
	});
};
