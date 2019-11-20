const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { buildAPIClient } = require('./apiclient');
const { LibraryInstallCommand } = require('../cmd');
const { CLILibraryInstallCommandSite } = require('./library_install');
const { JSONResult } = require('../lib/json-result');


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
		const { readme, source, header, json } = this.argv;
		const { name } = this.metadata;
		const { targetDir } = this;

		if (readme){
			this.showFile(
				'No readme files found for the library.',
				[
					path.join(targetDir, 'README.md'),
					path.join(targetDir, 'README.txt')
				]
			);
		}

		if (source){
			this.showFile(
				'No source files found for the library.',
				[
					path.join(targetDir, 'src', `${name}.cpp`)
				]
			);
		}

		if (header){
			this.showFile(
				'No header files found for the library.',
				[
					path.join(targetDir, 'src', `${name}.h`)
				]
			);
		}

		if (json){
			if (readme || source || header){
				return;
			}
			return console.log(
				this.createJSONResult()
			);
		}
		console.log(`To view the library documentation and sources directly, please change to the directory ${chalk.bold(targetDir)}`);
	}

	showFile(missing, filenames){
		const { json } = this.argv;
		let shown = false;

		for (let filename of filenames){
			const content = this.loadFile(filename);

			if (content !== undefined){
				if (json){
					console.log(
						this.createJSONResult(content)
					);
				} else {
					console.log(content);
				}

				shown = true;
				break;
			}
		}

		if (!shown){
			if (json){
				console.log(
					this.createJSONResult()
				);
			} else {
				console.log(missing);
			}
		}
	}

	createJSONResult(content = null){
		const data = Object.assign({ content }, this.metadata);
		const meta = { filter: data.name, location: this.targetDir };
		return new JSONResult(meta, data).toString();
	}

	loadFile(filename){
		try {
			return fs.readFileSync(filename, 'utf-8');
		} catch (error){
			return undefined;
		}
	}
}


module.exports.command = (apiJS, argv) => {
	const site = new CLILibraryViewCommandSite(argv, process.cwd(), buildAPIClient(apiJS));
	const cmd = new LibraryInstallCommand();
	return site.run(cmd)
		.then(() => site.view())
		.catch(error => {
			error.asJSON = argv.json;
			throw error;
		});
};

