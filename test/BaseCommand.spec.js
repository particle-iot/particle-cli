var Spinner = require('./mocks/Spinner.mock.js');
var Interpreter = require('../lib/interpreter');
var proxyquire = require('proxyquire');

var stream = require('stream');
var should = require('should');


var BaseCommand = proxyquire('../commands/BaseCommand', {
	'cli-spinner': Spinner
});

describe('BaseCommand', function() {

	var cli;
	var base;

	before(function() {

		cli = new Interpreter();
		cli.startup();

		base = new BaseCommand(cli);
	});

	describe('Spinner', function() {

		it('Displays text', function() {

			base.newSpin('test');
			base.__spin.text.should.equal('test');
		});

		it('Can be started', function() {

			base.startSpin();
			base.__spin.running.should.equal(true);
		});

		it('Can be stopped', function() {

			base.stopSpin();
			base.__spin.running.should.equal(false);
		});

	});
});
