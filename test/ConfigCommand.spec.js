var Spinner = require('./mocks/Spinner.mock.js');
var Interpreter = require('../lib/interpreter');
var proxyquire = require('proxyquire');
var ApiClient2 = require('../lib/ApiClient2');
var ApiClient = require('../lib/ApiClient');

var should = require('should');

var ConfigCommand = proxyquire('../commands/ConfigCommand', {
	'cli-spinner': Spinner,
	'../settings.js': settings
});

function settings() {

	this.switched = false;
	this.overridden = false;
};
settings.switchProfile = function() {

	this.switched = true;
}
settings.override = function() {

	this.overridden = true;
}

describe('Config Command', function() {

	var cli;
	var config;

	before(function() {

		cli = new Interpreter();
		cli.startup();

		config = new ConfigCommand(cli);
	});

	it('Can identify config', function() {

		config.optionsByName['identify'].should.be.instanceOf(Function);
	});

	it('Can list configs', function() {

		config.optionsByName['list'].should.be.instanceOf(Function);
	});
	it('Can switch profiles', function() {

		config.switchGroup('test');
		settings.switched.should.equal(true);
	});
	it('Can change settings', function() {

		config.changeSetting('test', 'change', 'setting');
		settings.overridden.should.equal(true);
	});
});