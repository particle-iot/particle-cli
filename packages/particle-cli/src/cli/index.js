const help = require('./help');
const alias = require('./alias');
const binary = require('./binary');
const cloud = require('./cloud');
const config = require('./config');
const doctor = require('./doctor');
const flash = require('./flash');
const func = require('./function');
const keys = require('./keys');
const library = require('./library');
const preprocess = require('./preprocess');
const project = require('./project');
const publish = require('./publish');
const serial = require('./serial');
const setup = require('./setup');
const subscribe = require('./subscribe');
const token = require('./token');
const udp = require('./udp');
const updateCli = require('./update-cli');
const update = require('./update');
const variable = require('./variable');
const version = require('./version');
const webhook = require('./webhook');
const whoami = require('./whoami');
const mesh = require('./mesh');
const usb = require('./usb');

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
module.exports = function registerAllCommands(context) {
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
	mesh(context);
	usb(context);
	alias(context);
};
