'use strict';

var Spinner = require('./mocks/Spinner.mock.js');
var Interpreter = require('../oldlib/interpreter');
var proxyquire = require('proxyquire');
require('should');
var sinon = require('sinon');
var fs = require('fs');

var settings = {

	username: 'test'

};

var HelpCommand = proxyquire('../commands/HelpCommand', {
	'cli-spinner': Spinner,
	'../settings.js': settings
});

describe('Help Command', function() {

	var cli;
	var help;
	var sandbox;

	before(function() {

		cli = new Interpreter();
		cli.startup();

		help = new HelpCommand(cli);
	});

	beforeEach(function() {
		sandbox = sinon.sandbox.create();
	});

	afterEach(function() {
		sandbox.restore();
	});

	it('Can output version', function() {

		help.optionsByName['version'].should.be.instanceOf(Function);
	});

	it('Prints current package version', function() {
		sandbox.stub(console, 'log');
		help.showVersion();
		console.log.called.should.be.true;
		var json = JSON.parse(fs.readFileSync(__dirname + '/../package.json'));
		console.log.firstCall.args[0].should.equal(json.version);
		sandbox.restore();
	});

});
