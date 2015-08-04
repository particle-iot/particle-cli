var Spinner = require('./mocks/Spinner.mock.js');
var Interpreter = require('../lib/interpreter');
var proxyquire = require('proxyquire');
var ApiClient2 = require('../lib/ApiClient2');
var ApiClient = require('../lib/ApiClient');

var should = require('should');

var settings = {

	username: 'test'

};

var AccessTokenCommand = proxyquire('../commands/AccessTokenCommands', {
	'cli-spinner': Spinner,
	'../settings.js': settings
});

describe('AccessToken Command', function() {

	var cli;
	var access;

	before(function() {

		cli = new Interpreter();
		cli.startup();

		access = new AccessTokenCommand(cli);
	});

	it('Can list tokens', function() {

		access.optionsByName['list'].should.be.instanceOf(Function);
	});

	it('Can revoke tokens', function() {

		access.optionsByName['revoke'].should.be.instanceOf(Function);
	});

	it('Can create tokens', function() {

		access.optionsByName['new'].should.be.instanceOf(Function);
	});

	it('Can check arguments', function() {

		access.checkArguments(['test', '--force', 'arguments']);
		access.options.force.should.equal(true);
	});

});