var Spinner = require('./mocks/Spinner.mock.js');
var Interpreter = require('../lib/interpreter');
var proxyquire = require('proxyquire');
var ApiClient2 = require('../lib/ApiClient2');
var ApiClient = require('../lib/ApiClient');

var should = require('should');
var sinon = require('sinon');

var settings = {

	username: 'test'

};

function when() {
	if(!(this instanceof when)) {
		return new when()
	}
	return this;
};
when.prototype.then = function() { return true; }

var KeyCommand = proxyquire('../commands/KeyCommands', {
	'cli-spinner': Spinner,
	'../settings.js': settings,
	'when': when,
	'../lib/utilities.js': utilities
});

function utilities() { };
sinon.stub(utilities, 'deferredChildProcess');

describe('Key Command', function() {

	var cli;
	var key;

	before(function() {

		cli = new Interpreter();
		cli.startup();

		key = new KeyCommand(cli);
		key.madeSSL = false;
	});


	it('Can create device key', function() {

		key.optionsByName['new'].should.be.instanceOf(Function);
		key.makeNewKey();
		process.nextTick(function() {
			utilities.deferredChildProcess.callCount.should.equal(3);
		});
	});

	it('Can load device key', function() {

		key.optionsByName['load'].should.be.instanceOf(Function);
	});

	it('Can save device key', function() {

		key.optionsByName['save'].should.be.instanceOf(Function);
	});

	it('Can send device key', function() {

		key.optionsByName['send'].should.be.instanceOf(Function);
	});

	it('Can switch server key', function() {

		key.optionsByName['new'].should.be.instanceOf(Function);
	});

	it('Can check arguments', function() {

		key.checkArguments([ '--force' ]);
		key.options.force.should.equal(true);
	});
});