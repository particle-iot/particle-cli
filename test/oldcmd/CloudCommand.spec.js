'use strict';

var Spinner = require('./../mocks/Spinner.mock.js');
var Interpreter = require('../../dist/lib/interpreter');
var proxyquire = require('proxyquire');

require('should');

var settings = {

	username: 'test'

};

var CloudCommand = proxyquire('../../commands/CloudCommands', {
	'cli-spinner': Spinner,
	'../settings.js': settings
});

describe('Cloud Command', function() {

	var cli;
	var cloud;

	before(function() {

		cli = new Interpreter();
		cli.startup();

		cloud = new CloudCommand(cli);
	});

	it('Can claim devices', function() {

		cloud.optionsByName['claim'].should.be.instanceOf(Function);
	});

	it('Can list devices', function() {

		cloud.optionsByName['list'].should.be.instanceOf(Function);
	});

	it('Can remove devices', function() {

		cloud.optionsByName['remove'].should.be.instanceOf(Function);
	});

	it('Can flash devices', function() {

		cloud.optionsByName['flash'].should.be.instanceOf(Function);
	});

	it('Can compile devices', function() {

		cloud.optionsByName['compile'].should.be.instanceOf(Function);
	});

	it('Can check arguments', function() {

		cloud.checkArguments([ 'test', '--saveTo', '/path/to/binary' ]);
		cloud.options.saveBinaryPath.should.equal('/path/to/binary');
	});

});
