/**
 * Created by David on 12/27/13.
 */


var Interpreter = require('./lib/interpreter.js');
var cli = new Interpreter();
cli.supressWarmupMessages = true;
cli.startup();
cli.handle(process.argv);


