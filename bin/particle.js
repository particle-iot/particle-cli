#!/usr/bin/env node

var chalk = require('chalk');
var path = require('path');
var fs = require('fs');
var lib = path.join(path.dirname(fs.realpathSync(__filename)), '../lib');
var Interpreter = require(lib + '/interpreter.js');
var cli = new Interpreter();

if(path.basename(process.argv[1]) == "spark") {
	console.log();
	console.log(chalk.yellow('!'), "You're using the", chalk.cyan('spark'), "command, which has been deprecated.");
	console.log(chalk.yellow('!'), "Please use the", chalk.cyan('particle'), "command instead, or suggest an alternative name!");
	console.log(chalk.yellow('!'), "Check out our blog post for more info:", chalk.cyan("http://blog.particle.io/2015/05/13/spark-is-now-particle/"));
	console.log();
}

cli.supressWarmupMessages = true;
cli.startup();
cli.handle(process.argv, true);
