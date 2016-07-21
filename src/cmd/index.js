import help from './help';
// import cloud from './cloud';
// import keys from './keys';
// import event from './event';
// import alias from './alias';

import echo from './echo';
import library from './library';
import libraryInit from './library_init';

/**
 * The command modules take the root command they should be registered in and the cli service
 * that provides factories for creating new commands and command categories.
 * @param {CLICommandCategory} app The location where this module's commands should be added.
 * @param {CLI} cli   The cli service.
 */
export default (app, cli) => {
	// help must come first
	help(app, cli);
	echo(app, cli);

	const lib = library(app, cli);
	libraryInit(lib, cli);

	// disable these for now until we have acceptance tests in place
	// cloud(app, cli);
	// keys(app, cli);
	// event(app, cli);
	// alias(app, cli);
};
