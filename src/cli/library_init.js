const { LibraryInitCommandSite, LibraryInitCommand } = require('../cmd');
const UI = require('../lib/ui');
const inquirer = require('inquirer');

class CLILibraryInitCommandSite extends LibraryInitCommandSite {
	constructor(argv) {
		super();
		this.ui = new UI();
		this.argv = argv;
	}

	options() {
		return this.argv;
	}

	arguments() {
		return this.argv.params || [];
	}

	prompter() {
		return inquirer.prompt;
	}

	outputStreamer() {
		return this.ui.stdout;
	}

}


module.exports.CLILibraryInitCommandSite = CLILibraryInitCommandSite;
module.exports.command = (argv) => {
	// todo - can we avoid the global dependency on process.cwd()
	// the cli itself should provide an environment, including cwd().
	const site = new CLILibraryInitCommandSite(argv, process.cwd());
	const cmd = new LibraryInitCommand();
	return site.run(cmd);
};

