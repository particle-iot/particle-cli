'use strict';

var proxyquire = require('proxyquire');
require('should');
require('temp');

/// This is old-style command implementation. No point maintaining this.

var LibraryCommand = require('../commands/LibraryCommand');


function InternalInvoker()
{

}

InternalInvoker.prototype.invoke = function() {
	var Interpreter = require('../dist/lib/interpreter.js');
	var cli = new Interpreter();
	cli.supressWarmupMessages = true;
	cli.startup();
	var dummyNodeArgs = [ 'node', 'particle.js'];
	cli.handle(dummyNodeArgs.concat(this.args), false);
};

function createInvoker(args) {
	var result = new InternalInvoker();
	result.args = args;
	return result;
}

describe('Library Command', function () {

	it('can describe the library subcommands', function() {
		var invoker = createInvoker();
		invoker.invoke('help', 'library');
	});

	it('can enumerate the remote libraries', function() {
		var invoker = createInvoker();
		invoker.invoke('library', 'available');
	});

	it('can install a remote library', function() {
		var invoker = createInvoker(['library', 'install', 'neopixel']);
		return invoker.invoke();
	});


	it('can describe the available libraries', function() {
		var cmd = new LibraryCommand();
	});
});

