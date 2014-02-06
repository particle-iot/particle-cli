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
var fs = require('fs');
var dfu = require('../lib/dfu.js');

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
                return utilities.deferredChildProcess("openssl rsa -in " + filename + ".pem -pubout -out " + filename + ".pub.pem");
            },
            function () {
                return utilities.deferredChildProcess("openssl rsa -in " + filename + ".pem -outform DER -out " + filename + ".der");
            }
        ]);
    },

    makeKeyUrsa: function (filename) {
        var key = ursa.generatePrivateKey(1024);
        fs.writeFileSync(filename + ".pem", key.toPrivatePem('binary'));
        fs.writeFileSync(filename + ".pub.pem", key.toPublicPem('binary'));

        //Hmm... OpenSSL is an installation requirement for URSA anyway, so maybe this fork is totally unnecessary...
        //in any case, it doesn't look like ursa can do this type conversion, so lets use openssl.
        return utilities.deferredChildProcess("openssl rsa -in " + filename + ".pem -outform DER -out " + filename + ".der");
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

    writeKeyToCore: function (filename) {

        if (!filename) {
            console.error("Please provide a filename to store this key.");
            return -1;
        }

        if (!fs.existsSync(filename)) {
            console.error("This file already exists, please specify a different file, or use the --force flag.");
            return -1;
        }

        //TODO: give the user a warning before doing this, since it'll bump their core offline.

        var ready = sequence([
            function () {
                //make sure our core is online and in dfu mode
                return dfu.findCompatiableDFU();
            },
            //backup their existing key so they don't lock themselves out.
            function() {
                //TODO: better process for making backup filename.
                this.saveKeyFromCore("pre_" + filename);
            },
            function () {
                return dfu.writePrivateKey(filename, false);
            }
        ]);

        when(ready).then(function () {
            console.log("Saved!");
        }, function (err) {
            console.error("Error saving key... " + err);
        });
    },

    saveKeyFromCore: function (filename) {
        if (!filename) {
            console.error("Please provide a filename to store this key.");
            return -1;
        }

        //TODO: check / ensure ".der" extension
        //TODO: check for --force flag

        if (fs.existsSync(filename)) {
            console.error("This file already exists, please specify a different file, or use the --force flag.");
            return -1;
        }

        //find dfu devices, make sure a core is connected
        //pull the key down and save it there

        var ready = sequence([
            function () {
                return dfu.findCompatiableDFU();
            },
            function () {
                return dfu.readPrivateKey(filename, false);
            }
        ]);

        when(ready).then(function () {
            console.log("Saved!");
        }, function (err) {
            console.error("Error saving key... " + err);
        });
    },

    sendPublicKeyToServer: function () {

    },


    _: null
});

module.exports = KeyCommands;
