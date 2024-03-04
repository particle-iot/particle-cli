const { LibraryInitCommandSite, LibraryInitCommand } = require('../cmd');
const { prompt } = require('../app/ui');

class CLILibraryInitCommandSite extends LibraryInitCommandSite {
	constructor(argv) {
		super();
		this.argv = argv;
	}

	options() {
		return this.argv;
	}

	arguments() {
		return this.argv.params || [];
	}

	prompter() {
		return prompt;
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

