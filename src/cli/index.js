const help = require('./help');
const alias = require('./alias');
const binary = require('./binary');
const bundle = require('./bundle');
const cloud = require('./cloud');
const config = require('./config');
const doctor = require('./doctor');
const esim = require('./esim');
const protection = require('./device-protection');
const flash = require('./flash');
const func = require('./function');
const keys = require('./keys');
const library = require('./library');
const logicFunction = require('./logic-function');
const preprocess = require('./preprocess');
const product = require('./product');
const project = require('./project');
const publish = require('./publish');
const serial = require('./serial');
const subscribe = require('./subscribe');
const token = require('./token');
const udp = require('./udp');
const updateCli = require('./update-cli');
const update = require('./update');
const variable = require('./variable');
const version = require('./version');
const webhook = require('./webhook');
const whoami = require('./whoami');
const wifi = require('./wifi');
const usb = require('./usb');
const setup = require('./setup');

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
	bundle(context);
	cloud(context);
	config(context);
	doctor(context);
	esim(context);
	protection(context);
	flash(context);
	func(context);
	keys(context);
	library(context);
	logicFunction(context);
	preprocess(context);
	product(context);
	project(context);
	publish(context);
	serial(context);
	subscribe(context);
	token(context);
	udp(context);
	updateCli(context);
	update(context);
	variable(context);
	version(context);
	webhook(context);
	whoami(context);
	wifi(context);
	usb(context);
	alias(context);
	setup(context);
};
