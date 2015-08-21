var Spinner = require('./mocks/Spinner.mock.js');
var Interpreter = require('../lib/interpreter');
var proxyquire = require('proxyquire');
var ApiClient2 = require('../lib/ApiClient2');
var ApiClient = require('../lib/ApiClient');

var should = require('should');

var FlashCommand = proxyquire('../commands/FlashCommand', {
	'cli-spinner': Spinner,
	'fs': fs,
	'../settings.js': settings,
	'../lib/dfu.js': dfu
});

function settings() { };
settings.knownApps['test'] = '/path/to/firmware';
settings.options = { useFactoryAddress: false };

function dfu() { };
dfu.findCompatibleDFU = function() { return true; }
dfu.writeFirmware = function() { return true; }

function fs() { this.willExist = true; };
fs.existsSync = function() { return this.willExist; }

describe('Flash Command', function() {

	var cli;
	var flash;

	before(function() {

		cli = new Interpreter();
		cli.startup();

		flash = new FlashCommand(cli);
	});

	it('Can flash locally', function() {

		flash.optionsByName['firmware'].should.be.instanceOf(Function);
		flash.flashDfu('test');
	});

	it('Can cloud flash', function() {

		flash.optionsByName['cloud'].should.be.instanceOf(Function);
		flash.cli.getCommandModule = function() {

			var x = function() { };
			x.flashDevice = function() { return true; }

			return x;
		};
		flash.flashCloud('test', 'firmware');
	});

	it('Can check arguments', function() {

		flash.checkArguments([ '--known', 'test' ]);
		flash.options.knownApp.should.equal('test');

		flash.checkArguments([ '--cloud' ]);
		flash.options.useCloud.should.equal(true);

		flash.checkArguments([ '--usb' ]);
		flash.options.useDfu.should.equal(true);

		flash.checkArguments([ '--factory' ]);
		flash.options.useFactoryAddress.should.equal(true);

	});

});