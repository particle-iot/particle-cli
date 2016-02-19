#!/usr/bin/env node
'use strict';
var path = require('path');
var fs = require('fs');
var lib = path.join(path.dirname(fs.realpathSync(__filename)), '../lib');
var Interpreter = require(lib + '/interpreter.js');
var cli = new Interpreter();

cli.supressWarmupMessages = true;
cli.startup();
cli.handle(process.argv, true);
