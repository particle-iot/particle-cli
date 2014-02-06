/**

 */
var when = require('when');
var pipeline = require('when/pipeline');

var sequence = require('when/sequence');
var readline = require('readline');
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var utilities = require('../lib/utilities.js');
var BaseCommand = require("./BaseCommand.js");
var ApiClient = require('../lib/ApiClient.js');
var moment = require('moment');
var child_process = require('child_process');
var ursa = require('ursa');

var KeyCommands = function (cli, options) {
    KeyCommands.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(KeyCommands, BaseCommand);
KeyCommands.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "keys",
    description: "tools to help you manage keys on your cores",


    init: function () {

        this.addOption("new", this.makeNewKey.bind(this), "Generate a new set of keys for your core");
        this.addOption("load", this.writeKeyToCore.bind(this), "Load a saved key on disk onto your core");
        this.addOption("save", this.saveKeyFromCore.bind(this), "Save a key from your core onto your disk");
        this.addOption("send", this.sendPublicKeyToServer.bind(this), "Tell a server which key you'd like to use by sending your public key");

        //this.addArgument("get", "--time", "include a timestamp")
        //this.addArgument("monitor", "--time", "include a timestamp")
        //this.addArgument("get", "--all", "gets all variables from the specified core")
        //this.addArgument("monitor", "--all", "gets all variables from the specified core")


        //this.addOption(null, this.helpCommand.bind(this));
    },

    checkArguments: function (args) {
        this.options = this.options || {};

//        if (!this.options.showTime) {
//            this.options.showTime = (utilities.contains(args, "--time"));
//        }

    },

    makeKeyOpenSSL: function (filename) {
        filename = utilities.filenameNoExt(filename);

        return sequence([
            function () {
                return utilities.deferredChildProcess("openssl genrsa -out " + filename + ".pem 1024");
            },
            function () {
                return utilities.deferredChildProcess("openssl rsa -in "+filename+".pem -pubout -out " + filename + ".pub.pem");
            },
            function () {
                return utilities.deferredChildProcess("openssl rsa -in "+filename+".pem -outform DER -out " + filename + ".der");
            }
        ]);
    },

    makeKeyUrsa: function (filename) {
        var key = ursa.createPrivateKey(data);
        key.toPrivatePem('binary');
        //console.log("public key is: ", coreKeys.toPublicPem('binary'));

        //TODO: convert to DER format
        //TODO: create public and private pem files.
    },


    makeNewKey: function (filename) {
        if (!filename) {
            filename = "core";
        }

        var keyReady;
        if (settings.useOpenSSL) {
            keyReady = this.makeKeyOpenSSL(filename);
        }
        else {
            keyReady = this.makeKeyUrsa(filename);
        }

        when(keyReady).then(function () {
            console.log("Created!");
        }, function (err) {
            console.error("Error creating keys... " + err);
        })
    },

    writeKeyToCore: function () {

    },

    saveKeyFromCore: function () {

    },

    sendPublicKeyToServer: function () {

    },


    _: null
});

module.exports = KeyCommands;
