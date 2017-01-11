import {CLILibraryInstallCommandSite} from './library_install';
import {LibraryInstallCommand} from '../cmd';
import {buildAPIClient} from './apiclient';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

class CLILibraryViewCommandSite extends CLILibraryInstallCommandSite {


	notifyFetchingLibrary(lib, targetDir) {
		this.targetDir = targetDir;
		this.targetExists = fs.existsSync(targetDir);
		return Promise.resolve(!this.targetExists);
	}

	notifyInstalledLibrary(lib, targetDir) {
		this.metadata = lib;
		if (!this.targetExists) {
			return super.notifyInstalledLibrary(lib, targetDir);
		}
	}

	view() {
		if (this.argv.readme) {
			this.showFile('No readme files found for the library.', ['README.md', 'README.txt']);
		}

		if (this.argv.source) {
			this.showFile('No source files found for the library.', [path.join('src', this.metadata.name+'.cpp')]);
		}

		if (this.argv.header) {
			this.showFile('No header files found for the library.', [path.join('src', this.metadata.name+'.h')]);
		}

		console.log(`To view the library documentation and sources directly, please change to the directory ${chalk.bold(this.targetDir)}`);
	}

	showFile(missing, files) {
		let shown = false;
		for (let file of files) {
			const content = this.loadFile(file);
			if (content!==undefined) {
				console.log(content);
				shown = true;
				break;
			}
		}

		if (!shown) {
			console.log(missing);
		}
	}

	loadFile(file) {
		const full = path.join(this.targetDir, file);
		try {
			return fs.readFileSync(full, 'utf-8');
		} catch (error) {

		}
	}
}

export default ({lib, factory, apiJS}) => {

	function libraryViewHandler(argv, apiJS) {
		const site = new CLILibraryViewCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
		const cmd = new LibraryInstallCommand();
		return site.run(cmd).then(() => site.view());
	}

	factory.createCommand(lib, 'view', 'View details about a library', {
		options: {
			'readme': {
				required:false,
				boolean:true,
				description: 'display the readme for the library'
			},
			'source': {
				required:false,
				boolean:true,
				description: 'display the main source file for the library'
			},
			'header': {
				required:false,
				boolean:true,
				description: 'display the main header file for the library'
			}

		},
		params: '<name>',
		handler: (argv) => libraryViewHandler(argv, apiJS),
	});

};
