var proxyquire = require('proxyquire');

var should = require('should');
var Interpreter = require('../lib/interpreter');

var SerialCommand = proxyquire('../commands/SerialCommand.js', {

});

describe('Serial Command', function() {

	var cli;
	var serial;

	before(function() {

		var cli = new Interpreter();
		cli.startup();

		serial = new SerialCommand(cli, { });

	});

	it('Can list devices', function() {

		serial.optionsByName['list'].should.be.an.instanceOf(Function);
	});

	it('Can monitor a device', function() {

		serial.optionsByName['monitor'].should.be.an.instanceOf(Function);
	});

	it('Can identify a device', function() {

		serial.optionsByName['identify'].should.be.an.instanceOf(Function);
	});

	it('Can setup Wi-Fi over serial', function() {

		serial.optionsByName['wifi'].should.be.an.instanceOf(Function);
	});

	it('can retrieve mac address', function() {

		serial.optionsByName['mac'].should.be.an.instanceOf(Function);
	});
});
