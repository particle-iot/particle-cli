#!/usr/bin/env node
/* eslint no-var: 0 */
global.verboseLevel = 1;
var app = require('../dist/cli/app');
app.run(process.argv);
