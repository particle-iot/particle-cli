'use strict';

var when = require('when');
var Spinner = require('./../mocks/Spinner.mock.js');
var Interpreter = require('../../dist/lib/interpreter');
var proxyquire = require('proxyquire');
require('should');

var PublishCommand = proxyquire('../../commands/PublishCommand', {
	'cli-spinner': Spinner,
	'../dist/lib/ApiClient.js': apiClient
});

var hasPublished = false;

function apiClient() { };
apiClient.prototype.publishEvent = function() {
	hasPublished = true;
	return when.resolve();
};
apiClient.prototype.ready = function() {
	return true;
};

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

		hasPublished.should.equal(true);
	});

});
