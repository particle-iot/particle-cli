const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { buildAPIClient } = require('./apiclient');
const { LibraryInstallCommand } = require('../cmd');
const { CLILibraryInstallCommandSite } = require('./library_install');


class CLILibraryViewCommandSite extends CLILibraryInstallCommandSite {
	async notifyFetchingLibrary(lib, targetDir){
		const targetExists = fs.existsSync(targetDir);

		if (!this.targetDir){
			this.targetDir = targetDir;
			this.targetExists = targetExists;
		}
		return !targetExists;
	}

	notifyInstalledLibrary(lib, targetDir){
		if (!this.metadata){
			this.metadata = lib;
		}
		return super.notifyInstalledLibrary(lib, targetDir);
	}

	view(){
		if (this.argv.readme){
			this.showFile('No readme files found for the library.', ['README.md', 'README.txt']);
		}

		if (this.argv.source){
			this.showFile('No source files found for the library.', [path.join('src', this.metadata.name+'.cpp')]);
		}

		if (this.argv.header){
			this.showFile('No header files found for the library.', [path.join('src', this.metadata.name+'.h')]);
		}

		console.log(`To view the library documentation and sources directly, please change to the directory ${chalk.bold(this.targetDir)}`);
	}

	showFile(missing, files){
		let shown = false;
		for (let file of files){
			const content = this.loadFile(file);
			if (content !== undefined){
				console.log(content);
				shown = true;
				break;
			}
		}

		if (!shown){
			console.log(missing);
		}
	}

	loadFile(file){
		const full = path.join(this.targetDir, file);
		try {
			return fs.readFileSync(full, 'utf-8');
		} catch (error){
			return undefined;
		}
	}
}


module.exports.command = (apiJS, argv) => {
	const site = new CLILibraryViewCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
	const cmd = new LibraryInstallCommand();
	return site.run(cmd).then(() => site.view());
};

