const TerminalAdapter = require('yeoman-environment/lib/adapter');
const { LibraryInitCommandSite, LibraryInitCommand } = require('../cmd');

/**
 * Provides the UI delegations required by yeoman. For now, we just use the
 * built-in one, but later we may delegate to our own implementation of prompts.
 */
class YeomanAdapter extends TerminalAdapter {
	constructor() {
		super();
		this.owner = this;
	}
}

class CLILibraryInitCommandSite extends LibraryInitCommandSite {
	constructor(argv) {
		super();
		this.argv = argv;
		this.adapter = new YeomanAdapter(this);
	}

	options() {
		return this.argv;
	}

	arguments() {
		return this.argv.params || [];
	}

	yeomanAdapter() {
		return this.adapter;
	}

	yeomanEnvironment() {
		return require('yeoman-environment');
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

