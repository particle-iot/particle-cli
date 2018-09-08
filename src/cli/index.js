import help from './help';
import alias from './alias';

import binary from './binary';
import cloud from './cloud';
import config from './config';
import doctor from './doctor';
import flash from './flash';
import func from './function';
import keys from './keys';
import library from './library';
import preprocess from './preprocess';
import project from './project';
import publish from './publish';
import serial from './serial';
import setup from './setup';
import subscribe from './subscribe';
import token from './token';
import udp from './udp';
import updateCli from './update-cli';
import update from './update';
import variable from './variable';
import version from './version';
import webhook from './webhook';
import whoami from './whoami';

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

	binary(context);
	cloud(context);
	config(context);
	doctor(context);
	flash(context);
	func(context);
	keys(context);
	library(context);
	preprocess(context);
	project(context);
	publish(context);
	serial(context);
	setup(context);
	subscribe(context);
	token(context);
	udp(context);
	updateCli(context);
	update(context);
	variable(context);
	version(context);
	webhook(context);
	whoami(context);
	alias(context);
}
