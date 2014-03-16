/**
 ******************************************************************************
 * @file    js/commands/SerialCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Serial commands module
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
var SerialPortLib = require("serialport");
var SerialPort = SerialPortLib.SerialPort;
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var prompts = require('../lib/prompts.js');
var utilities = require('../lib/utilities.js');

var SerialCommand = function (cli, options) {
    SerialCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(SerialCommand, BaseCommand);
SerialCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "serial",
    description: "simple serial interface to your cores",


    init: function () {
        this.addOption("list", this.listPorts.bind(this), "Show Cores connected via serial to your computer");
        this.addOption("monitor", this.monitorPort.bind(this), "Connect and display messages from a core");
        this.addOption("identify", this.identifyCore.bind(this), "Ask for and display core ID via serial");
        this.addOption("wifi", this.configureWifi.bind(this), "Configure wifi credentials over serial");

        //this.addOption(null, this.helpCommand.bind(this));
    },


    listPorts: function (args) {
        this.findCores(function (cores) {
            console.log("Found " + cores.length + " core(s) connected via serial: ");
            for (var i = 0; i < cores.length; i++) {
                console.log((i + 1) + ":\t" + cores[i].comName);
            }
            console.log("");
        });
    },

    monitorPort: function (comPort) {
        this.whatSerialPortDidYouMean(comPort, true, function(port) {
            console.log("Opening serial monitor for com port: \"" + port + "\"");

            //TODO: listen for interrupts, close gracefully?
            var serialPort = new SerialPort(port, {
                baudrate: 9600
            }, false);
            serialPort.on('data', function (data) {
                process.stdout.write(data.toString());
            });
            serialPort.open(function (err) {
                if (err) {
                    console.error("Serial err: " + err);
                    console.error("Serial problems, please reconnect the core.");
                }
            });
        });
    },


    findCores: function (callback) {
        var cores = [];
        SerialPortLib.list(function (err, ports) {
            for (var i = 0; i < ports.length; i++) {
                var port = ports[i];

                //not trying to be secure here, just trying to be helpful.
                if ((port.manufacturer && port.manufacturer.indexOf("Spark") >= 0) ||
                    (port.pnpId && port.pnpId.indexOf("Spark_Core") >= 0))
                {
                    cores.push(port);
                }
            }
            callback(cores);
        });
    },

    closeSerial: function () {
        if (this.serialPort) {
            this.serialPort.close();
            this.serialPort = null;
        }
    },


    /**
     * Check to see if the core is in listening mode, try to get the code ID via serial
     * @param comPort
     * @returns {promise|*|Promise|promise}
     */
    identifyCore: function (comPort) {
        var tmp = when.defer();

        var that = this;
        this.whatSerialPortDidYouMean(comPort, true, function (port) {
            if (!port) {
                tmp.reject("No serial port identified");
                return;
            }

            utilities.pipeDeferred(that.askForCoreID(port), tmp);
        });

        return tmp.promise;
    },
    configureWifi: function (comPort, dontExit) {
        var tmp = when.defer();
        var that = this;
        this.whatSerialPortDidYouMean(comPort, true, function (port) {

            //ask for ssid, pass, security type
            var gotCreds = sequence([
                function() { return prompts.promptDfd("SSID:\t"); },
                function() { return prompts.promptDfd("Pass:\t"); },
                function() { return prompts.promptDfd("Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2:\t"); }
            ]);

            when(gotCreds).then(function(creds) {
                var wifiDone = that.serialWifiConfig(port, creds[0], creds[1], creds[2]);

                utilities.pipeDeferred(wifiDone, tmp);

                //TODO: fix this, this is awkward
                if (!dontExit) {
                    when(wifiDone).ensure(function () {
                        setTimeout(function () {
                            process.exit(0);
                        }, 1250);
                    })
                }
            });
        });

        return tmp.promise;
    },


    serialWifiConfig: function (comPort, ssid, pass, secType, failDelay) {
        var dfd = when.defer();
        failDelay = failDelay || 5000;

        var failTimer = setTimeout(function () {
            dfd.reject("Serial Timed out - Please try restarting your core");
        }, failDelay);

        console.log("Attempting to configure wifi on " + comPort);

        var serialPort = this.serialPort || new SerialPort(comPort, {
            baudrate: 9600
        }, false);

        //TODO: correct interaction for unsecured networks
        //TODO: drop the pre-prompt creds process entirely when we have the built in serial terminal

        var writeChunkIndex = 0;
        var writeChunks = [
            "w",
            ssid + "\n",
            secType + "\n",
            pass + "\n",
            "\n"
        ];

        var writeNextChunk = function () {
            if (writeChunkIndex < writeChunks.length) {
                serialPort.write(writeChunks[writeChunkIndex], function () {});
                writeChunkIndex++;
                return true;
            }
            return false;
        };


        //keep listening for data until we haven't received anything for...
        var boredDelay = 250,
            boredTimer,
            chunks = [];

        var whenBored = function () {
            var data = chunks.join("");
            chunks = [];

            if (!writeNextChunk()) {
                if (data.indexOf("Spark <3 you!") >= 0) {
                    console.log("Configured: Spark <3 you!");
                    dfd.resolve(data);
                }
            }
        };

        serialPort.on('data', function (data) {
            clearTimeout(failTimer);
            clearTimeout(boredTimer);
            chunks.push(data);
            boredTimer = setTimeout(whenBored, boredDelay);
        });
        when(dfd.promise).ensure(function () {
            serialPort.removeAllListeners("open");
            serialPort.removeAllListeners("data");
        });
        serialPort.open(function () {
            writeNextChunk();
        });


        dfd.promise.then(
            function () {
                console.log("Done!  Your core should now restart.");
            },
            function (err) {
                console.error("Something went wrong " + err);
            });

        when(dfd.promise).ensure(function () {
            serialPort.close();
        });

        return dfd.promise;
    },




    askForCoreID: function (comPort) {
        if (!comPort) {
            return when.reject("askForCoreID - no serial port provided");
        }

        var failDelay = 5000;

        var dfd = when.defer();

        try {
            //keep listening for data until we haven't received anything for...
            var boredDelay = 100,
                boredTimer,
                chunks = [];

            var serialPort = new SerialPort(comPort, {
                baudrate: 9600
            }, false);
            this.serialPort = serialPort;


            var whenBored = function () {
                var data = chunks.join("");
                var prefix = "Your core id is ";
                data = data.replace(prefix, "").trim();
                dfd.resolve(data);
            };


            var failTimer = setTimeout(function () {
                dfd.reject("Serial timed out");
            }, failDelay);


            serialPort.on('data', function (data) {
                clearTimeout(failTimer);
                clearTimeout(boredTimer);

                chunks.push(data);
                boredTimer = setTimeout(whenBored, boredDelay);
            });

            serialPort.open(function (err) {
                if (err) {
                    console.error("Serial err: " + err);
                    console.error("Serial problems, please reconnect the core.");
                    dfd.reject("Serial problems, please reconnect the core.");
                }
                else {
                    serialPort.write("i", function (err, results) { });
                }
            });

            when(dfd.promise).ensure(function () {
                serialPort.removeAllListeners("open");
                serialPort.removeAllListeners("data");
            });
        }
        catch (ex) {
            console.error("Errors while trying to get coreID -- disconnect and reconnect core");
            dfd.reject("Serial errors");
        }


        dfd.promise.then(
            function (data) {
                console.log("Your core id is: " + data);
            },
            function (err) {
                console.error("Something went wrong " + err);
            });

        when(dfd.promise).ensure(function () {
            serialPort.close();
        });
        return dfd.promise;
    },


    whatSerialPortDidYouMean: function(comPort, shouldPrompt, callback) {
        this.findCores(function (cores) {
            if (!comPort) {
                //they didn't give us anything.
                if (cores.length == 1) {
                    //we have exactly one core, use that.
                    return callback(cores[0].comName);
                }
                //else - which one?
            }
            else {
                var portNum = parseInt(comPort);
                if (!isNaN(portNum)) {
                    //they gave us a number
                    if (portNum > 0) {
                        portNum -= 1;
                    }

                    if (cores.length > portNum) {
                        //we have it, use it.
                        return callback(cores[portNum].comName);
                    }
                    //else - which one?
                }
                else {
                    //they gave us a string
                    //doesn't matter if we have it or not, give it a try.
                    return callback(comPort);
                }
            }

            if (cores.length > 0) {
                console.log("Which core did you mean?");
                console.log("Found " + cores.length + " core(s) connected via serial: ");
                for (var i = 0; i < cores.length; i++) {
                    console.log((i + 1) + ":\t" + cores[i].comName);
                }
                console.log("");
            }
            else {
                console.log("I didn't find any cores available via serial");
                if (shouldPrompt) { callback(null); }
                return;
            }

            if (shouldPrompt && (cores.length > 0)) {
                //ask then what we meant, and try again...
                var that = this;
                when(prompts.promptDfd(": ")).then(function (value) {
                    that.whatSerialPortDidYouMean(value, true, callback);
                });
            }
        });
    },

    _: null
});

module.exports = SerialCommand;
