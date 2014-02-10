/**

 */
var when = require('when');
var sequence = require('when/sequence');
var readline = require('readline');
var SerialPortLib = require("serialport");
var SerialPort = SerialPortLib.SerialPort;
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var prompts = require('../lib/prompts.js');
var ApiClient = require('../lib/ApiClient.js');

var CloudCommand = function (cli, options) {
    CloudCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(CloudCommand, BaseCommand);
CloudCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "cloud",
    description: "simple interface for common cloud functions",


    init: function () {
        this.addOption("claim", this.claimCore.bind(this), "Register a core with your user account with the cloud");
        this.addOption("name", this.nameCore.bind(this), "Give a core a name!");

    },

    claimCore: function(coreid) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }


        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;
        api.claimCore(coreid);
    },

    nameCore: function(coreid, name) {
        if (!coreid) {
            console.error("Please specify a coreid");
            return;
        }

        if (!name) {
            console.error("Please specify a name");
            return;
        }


        //TODO: replace with better interactive init
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;

        api.renameCore(coreid, name);
    },


    _: null
});

module.exports = CloudCommand;
