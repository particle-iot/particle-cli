import help from './help';
// import cloud from './cloud';
// import keys from './keys';
// import event from './event';
// import alias from './alias';

import echo from './echo';
import accessTokens from './access_tokens';
import binary from './binary';
import cloud from './cloud';
import config from './config';
import doctor from './doctor';
import flash from './flash';
import func from './function';
import library from './library';
import project from './project';
import publish from './publish';
import keys from './keys';
import serial from './serial';
import setup from './setup';
import subscribe from './subscribe';
import udp from './udp';
import update from './update';
import variable from './variable';
import webhook from './webhook';

/**
 * The default function export from this module registers all the available commands.
 * Each command is contained in it's own module, for..er...modularity.
 *
 * The command modules take an object as the argument with these properties:
 *  commandProcessor: the command processor service that provides factories for creating
 *      new commands and command categories and for invoking commands.
 *  root: the root command which is used to register top-level commands.
 *  app: the executing CLI instance. This can be used to modify the command line and re-execute
 *   the new command line by calling `app.runCommand(cmdarray)`.
 *
 * @param {object} context  The context for configuring the command.
 */
export default function registerAllCommands(context) {
	// help must come first
	help(context);

	echo(context);
	accessTokens(context);
	binary(context);
	cloud(context);
	config(context);
	doctor(context);
	flash(context);
	func(context);
	library(context);
	project(context);
	publish(context);
	keys(context);
	serial(context);
	setup(context);
	subscribe(context);
	udp(context);
	update(context);
	variable(context);
	webhook(context);
	// disable these for now until we have acceptance tests in place
	// cloud(app, cli);
	// event(app, cli);
	// alias(app, cli);
}
