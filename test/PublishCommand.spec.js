var Spinner = require('./mocks/Spinner.mock.js');
var Interpreter = require('../lib/interpreter');
var proxyquire = require('proxyquire');
var ApiClient2 = require('../lib/ApiClient2');
var ApiClient = require('../lib/ApiClient');

var should = require('should');

var PublishCommand = proxyquire('../commands/PublishCommand', {
	'cli-spinner': Spinner,
	'../lib/ApiClient.js': apiClient
});

var hasPublished = false;

function apiClient() { };
apiClient.prototype.publishEvent = function() { hasPublished = true; }
apiClient.prototype.ready = function() { return true; }

describe('Publish Command', function() {

	var cli;
	var publish;

	before(function() {

		cli = new Interpreter();
		cli.startup();

		publish = new PublishCommand(cli);
	});

	it('Can publish messages', function() {

		publish.optionsByName['*'].should.be.instanceOf(Function);
		publish.publishEvent('test', 'test');

		hasPublished.should.equal(true)
	});

});