import { LibraryInitCommandSite, LibraryInitCommand } from '../cmd';

const TerminalAdapter = require('yeoman-environment/lib/adapter.js');

/**
 * Provides the UI delegations required by yeoman. For now, we just use the
 * built-in one, but later we may delegate to our own implementation of prompts.
 */
class YeomanAdapter extends TerminalAdapter {

	constructor(owner) {
		super();
		this.owner = this;
	}
}


export class CLILibraryInitCommandSite extends LibraryInitCommandSite {
	constructor(argv, cwd) {
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

export function command(executor, argv) {
	// todo - can we avoid the global dependency on process.cwd()
	// the cli itself should provide an environment, including cwd().
	const site = new CLILibraryInitCommandSite(argv, process.cwd());
	const cmd = new LibraryInitCommand();
	return executor.run(site, cmd);
}
