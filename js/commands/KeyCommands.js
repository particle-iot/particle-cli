/**
 ******************************************************************************
 * @file    js/commands/KeyCommands.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Key commands module
 ******************************************************************************
  Copyright (c) 2014 Spark Labs, Inc.  All rights reserved.

  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU Lesser General Public
  License as published by the Free Software Foundation, either
  version 3 of the License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
  Lesser General Public License for more details.

  You should have received a copy of the GNU Lesser General Public
  License along with this program; if not, see <http://www.gnu.org/licenses/>.
  ******************************************************************************
 */
var when = require('when');
var sequence = require('when/sequence');
var readline = require('readline');
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var utilities = require('../lib/utilities.js');
var BaseCommand = require("./BaseCommand.js");
var ApiClient = require('../lib/ApiClient.js');
var moment = require('moment');
//var ursa = require('ursa');
var fs = require('fs');
var path = require('path');
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
        this.addOption("doctor", this.keyDoctor.bind(this), "Creates and assigns a new key to your core, and uploads it to the cloud");
        this.addOption("server", this.writeServerPublicKey.bind(this), "Switch server public keys");

        //this.addArgument("get", "--time", "include a timestamp")
        //this.addArgument("monitor", "--time", "include a timestamp")
        //this.addArgument("get", "--all", "gets all variables from the specified core")
        //this.addArgument("monitor", "--all", "gets all variables from the specified core")
        //this.addOption(null, this.helpCommand.bind(this));
    },

    checkArguments: function (args) {
        this.options = this.options || {};

        if (!this.options.force) {
            this.options.force = utilities.tryParseArgs(args,
                "--force",
                null
            );
        }

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

//    makeKeyUrsa: function (filename) {
//        var key = ursa.generatePrivateKey(1024);
//        fs.writeFileSync(filename + ".pem", key.toPrivatePem('binary'));
//        fs.writeFileSync(filename + ".pub.pem", key.toPublicPem('binary'));
//
//        //Hmm... OpenSSL is an installation requirement for URSA anyway, so maybe this fork is totally unnecessary...
//        //in any case, it doesn't look like ursa can do this type conversion, so lets use openssl.
//        return utilities.deferredChildProcess("openssl rsa -in " + filename + ".pem -outform DER -out " + filename + ".der");
//    },


    makeNewKey: function (filename) {
        if (!filename) {
            filename = "core";
        }

        var keyReady;
        //if (settings.useOpenSSL) {
            keyReady = this.makeKeyOpenSSL(filename);
        //}
        //else {
        //    keyReady = this.makeKeyUrsa(filename);
        //}

        when(keyReady).then(function () {
            console.log("New Key Created!");
        }, function (err) {
            console.error("Error creating keys... " + err);
        });

        return keyReady;
    },

    writeKeyToCore: function (filename, leave) {
        this.checkArguments(arguments);


        if (!filename) {
            console.error("Please provide a filename for this key.");
            return when.reject("Please provide a filename for this key.");
        }

        filename = utilities.filenameNoExt(filename) + ".der";
        if (!fs.existsSync(filename)) {
            console.error("I couldn't find the file: " + filename);
            return when.reject("I couldn't find the file: " + filename);
        }

        //TODO: give the user a warning before doing this, since it'll bump their core offline.
        var that = this;

        var ready = sequence([
            function () {
                //make sure our core is online and in dfu mode
                return dfu.findCompatibleDFU();
            },
            //backup their existing key so they don't lock themselves out.
            function() {
                var prefilename = path.join(
                        path.dirname(filename),
                    "pre_" + path.basename(filename)
                );
                return that.saveKeyFromCore(prefilename);
            },
            function () {
                return dfu.writePrivateKey(filename, leave);
            }
        ]);

        when(ready).then(function () {
            console.log("Saved!");
        }, function (err) {
            console.error("Error saving key... " + err);
        });

        return ready;
    },



    saveKeyFromCore: function (filename) {
        if (!filename) {
            console.error("Please provide a filename to store this key.");
            return when.reject("Please provide a filename to store this key.");
        }

        //TODO: check / ensure ".der" extension
        this.checkArguments(arguments);

        if ((!this.options.force) && (fs.existsSync(filename))) {
            console.error("This file already exists, please specify a different file, or use the --force flag.");
            return when.reject("This file already exists, please specify a different file, or use the --force flag.");
        }

        //find dfu devices, make sure a core is connected
        //pull the key down and save it there

        var ready = sequence([
            function () {
                return dfu.findCompatibleDFU();
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

        return ready;
    },

    sendPublicKeyToServer: function (coreid, filename) {
        if (!coreid) {
            console.log("Please provide a core id");
            return when.reject("Please provide a core id");
        }

        if (!filename) {
            console.log("Please provide a filename for your core's public key ending in .pub.pem");
            return when.reject("Please provide a filename for your core's public key ending in .pub.pem");
        }

        if (!fs.existsSync(filename)) {
            filename = utilities.filenameNoExt(filename) + ".pub.pem";
            if (!fs.existsSync(filename)) {
                console.error("Couldn't find " + filename);
                return when.reject("Couldn't find " + filename);
            }
        }

        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return;
        }

        var keyStr = fs.readFileSync(filename).toString();
        return api.sendPublicKey(coreid, keyStr);
    },

    keyDoctor: function (coreid) {
        if (!coreid) {
            console.log("Please provide your core id");
            return 0;
        }

        var that = this;
        var allDone = sequence([
            function () {
                return dfu.findCompatibleDFU();
            },
            function() {
                return that.makeNewKey(coreid + "_new");
            },
            function() {
                return that.writeKeyToCore(coreid + "_new", true);
            },
            function() {
                return that.sendPublicKeyToServer(coreid, coreid + "_new");
            }
        ]);

        when(allDone).then(
            function () {
                console.log("Okay!  New keys in place, your core should restart.");

            },
            function (err) {
                console.log("Make sure your core is in DFU mode (blinking yellow), and that your computer is online.");
                console.error("Error - " + err);
            });
    },

        writeServerPublicKey: function (filename) {
        if (!filename || (!fs.existsSync(filename))) {
            console.log("Please specify a server key in DER format.");
            return -1;
        }

        var allDone = dfu.writeServerKey(filename, false);
        when(allDone).then(
            function () {
                console.log("Okay!  New keys in place, your core will not restart.");

            },
            function (err) {
                console.log("Make sure your core is in DFU mode (blinking yellow), and is connected to your computer");
                console.error("Error - " + err);
            });
    },


    _: null
});

module.exports = KeyCommands;
