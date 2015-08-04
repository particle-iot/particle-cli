var Spinner = require('./mocks/Spinner.mock.js');
var Interpreter = require('../lib/interpreter');
var proxyquire = require('proxyquire');
var ApiClient2 = require('../lib/ApiClient2');
var ApiClient = require('../lib/ApiClient');

var should = require('should');

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

	before(function() {

		cli = new Interpreter();
		cli.startup();

		help = new HelpCommand(cli);
	});

	it('Can output version', function() {

		help.optionsByName['version'].should.be.instanceOf(Function);
	});

});