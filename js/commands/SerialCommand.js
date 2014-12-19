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
var pipeline = require('when/pipeline');

var readline = require('readline');
var SerialPortLib = require("serialport");
var SerialPort = SerialPortLib.SerialPort;
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var prompts = require('../lib/prompts.js');
var utilities = require('../lib/utilities.js');
var SerialBoredParser = require('../lib/SerialBoredParser.js');
var wifiscanner = require('node-wifiscanner/lib/wifiscanner.js');

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


    checkArguments: function (args) {
        this.options = this.options || {};

        if (!this.options.follow) {
            this.options.follow = utilities.tryParseArgs(args,
                "--follow",
               null
            );
        }
    },

    monitorPort: function (comPort) {
        var handlePortFn = function (port) {
            if (!port) {
                console.error("No serial port identified");
                return;
            }

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
        };

        this.checkArguments(arguments);

        if (this.options.follow) {
            //catch the serial port dying, and keep retrying forever
            //TODO: needs serialPort error / close event / deferred
        }

        this.whatSerialPortDidYouMean(comPort, true, handlePortFn);
    },


    findCores: function (callback) {
        var cores = [];
        SerialPortLib.list(function (err, ports) {

            //grab anything that self-reports as a core
            for (var i = 0; i < ports.length; i++) {
                var port = ports[i];

                //not trying to be secure here, just trying to be helpful.
                if ((port.manufacturer && port.manufacturer.indexOf("Spark") >= 0) ||
                    (port.pnpId && port.pnpId.indexOf("Spark_Core") >= 0) ||
                     port.pnpId && port.pnpId.indexOf("VID_1D50") >= 0) {
                    cores.push(port);
                }
            }

            //if I didn't find anything, grab any 'ttyACM's
            if (cores.length == 0) {
                for (var i = 0; i < ports.length; i++) {
                    var port = ports[i];

                    //if it doesn't have a manufacturer or pnpId set, but it's a ttyACM port, then lets grab it.
                    if (port.comName.indexOf('/dev/ttyACM') == 0) {
                        cores.push(port);
                    }
                    else if (port.comName.indexOf('/dev/cuaU') == 0) {
                        cores.push(port);
                    }
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

        var failTimer = setTimeout(function() {
            tmp.reject("Timed out");
        }, 5000);

        var that = this;
        this.whatSerialPortDidYouMean(comPort, true, function (port) {
            if (!port) {
                tmp.reject("No serial port identified");
                return;
            }

            utilities.pipeDeferred(that.askForCoreID(port), tmp);
        });

        when (tmp.promise).ensure(function() {
            clearTimeout(failTimer);
        });

        return tmp.promise;
    },
    configureWifi: function (comPort, dontExit) {
        var tmp = when.defer();
        var that = this;
        this.whatSerialPortDidYouMean(comPort, true, function (port) {
            if (!port) {
                tmp.reject("No serial port identified");
                return;
            }

            var ssid, password, security;

            //ask for ssid, pass, security type
            var gotCreds = pipeline([
                function () {
                    var dfd = when.defer();
                    wifiscanner.scan(function(err, data){
                        if (err) {
                            //console.log("[Error] - " + err);
                            dfd.reject(err);
                        }
                        //console.log(data);
                        dfd.resolve(data);
                    });
                    return dfd.promise;
                },
                function (arg) {
                    console.log("I found the following potentially-compatible SSIDs:");
                    for (var i = arg.length - 1; i >= 0; i--) {
                        AP = arg[i];
                        if(AP.channel > 11)
                            continue;
                        console.log("\t" + AP.ssid)
                    };
                    console.log();
                    return prompts.promptDfd("SSID: ");
                },
                function (arg) {
                    ssid = arg;
                    return prompts.promptDfd("Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2: ");
                },
                function (arg) {
                    security = arg;
                    if (security == "0") {
                        return when.resolve();
                    }
                    return prompts.promptDfd("Wifi Password: ");
                },
                function (arg) {
                    password = arg;
                    return when.resolve();
                }
            ]);

            when(gotCreds).then(function () {
                var wifiDone = that.serialWifiConfig(port, ssid, password, security);

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

    //spark firmware version 1:

    //SSID: Test
    //Password: Test
    //Thanks! Wait about 7 seconds while I save those credentials...


    /**
     * wait for a prompt, optionally write back and answer, and optionally time out if the prompt doesn't appear in time.
     * @param prompt
     * @param answer
     */
    serialPromptDfd: function (serialPort, prompt, answer, timeout, alwaysResolve) {
        //console.log("waiting on " + prompt + " answer will be " + answer);

        var dfd = when.defer(),
            failTimer,
            showTraffic = true;

        var writeAndDrain = function (data, callback) {
            serialPort.write(data, function () {
                serialPort.drain(callback);
            });
        };

        if (timeout) {
            failTimer = setTimeout(function () {
                if (showTraffic) { console.log("timed out on " + prompt); }
                if (alwaysResolve) {
                    dfd.resolve(null);
                }
                else {
                    dfd.reject("Serial prompt timed out - Please try restarting your core");
                }
            }, timeout);
        }


        if (prompt) {
            var onMessage = function (data) {
                data = data.toString();

                if (showTraffic) { console.log("Serial said: " + data);}
                if (data && data.indexOf(prompt) >= 0) {
                    if (answer) {
                        serialPort.flush(function() {});

                        writeAndDrain(answer, function () {
                            if (showTraffic) { console.log("I said: " + answer);}
                            //serialPort.pause();     //lets not miss anything
                            dfd.resolve(true);
                        });
                    }
                    else {
                        dfd.resolve(true);
                    }
                }
            };

            serialPort.on('data', onMessage);
            //serialPort.resume();

            when(dfd.promise).ensure(function () {
                clearTimeout(failTimer);
                serialPort.removeListener('data', onMessage);
            });
        }
        else if (answer) {
            clearTimeout(failTimer);

            if (showTraffic) { console.log("I said: " + answer);}
            writeAndDrain(answer, function () {
                //serialPort.pause();     //lets not miss anything
                dfd.resolve(true);
            });
        }
        return dfd.promise;
    },


    serialWifiConfig: function (comPort, ssid, password, securityType, failDelay) {
        if (!comPort) {
            return when.reject("No serial port available");
        }

        console.log("Attempting to configure wifi on " + comPort);

        var serialPort = this.serialPort || new SerialPort(comPort, {
            baudrate: 9600,
            parser: SerialBoredParser.MakeParser(250)
        }, false);

        serialPort.on('error', function () {
            //yeah, don't care.
            console.error("Serial error:", arguments);
        });

        var that = this,
            wifiDone = when.defer();

        serialPort.open(function () {
            var configDone = pipeline([
                function () {
                    return that.serialPromptDfd(serialPort, null, "w", 5000, true);
                },
                function (result) {
                    if (!result) {
                        return that.serialPromptDfd(serialPort, null, "w", 5000, true);
                    }
                    else {
                        return when.resolve();
                    }
                },
                function () {
                    return that.serialPromptDfd(serialPort, "SSID:", ssid + "\n", 5000, false);
                },
                function () {
                    return that.serialPromptDfd(serialPort, "Security 0=unsecured, 1=WEP, 2=WPA, 3=WPA2:", securityType + "\n", 1500, true);
                },
                function (result) {
                    var passPrompt = "Password:";
                    if (!result) {
                        //no security prompt, must have had pass prompt.

                        //normally we would wait for the password prompt, but the 'security' line will have received the
                        //prompt instead, so lets assume we're good since we already got the ssid prompt, and just pipe
                        //the pass.

                        if (securityType == "0") {
                            //we didn't have a password, so just hit return
                            serialPort.write("\n");

                        }
                        passPrompt = null;
                    }

                    if (!passPrompt || !password || (password == "")) {
                        return when.resolve();
                    }

                    return that.serialPromptDfd(serialPort, passPrompt, password + "\n", 5000);
                },
                function () {
                    return that.serialPromptDfd(serialPort, "Spark <3 you!", null, 15000);
                }
            ]);
            utilities.pipeDeferred(configDone, wifiDone);
        });


        when(wifiDone.promise).then(
            function () {
                console.log("Done!  Your core should now restart.");
            },
            function (err) {
                console.error("Something went wrong " + err);
            });

        when(wifiDone.promise).ensure(function () {
            serialPort.close();
        });

        return wifiDone.promise;

        //TODO: correct interaction for unsecured networks
        //TODO: drop the pre-prompt creds process entirely when we have the built in serial terminal
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
                baudrate: 9600,
                parser: SerialBoredParser.MakeParser(250)
            }, false);
            this.serialPort = serialPort;


            var whenBored = function () {
                var data = chunks.join("");
                var prefix = "Your core id is ";
                if (data.indexOf(prefix) >= 0) {
                    data = data.replace(prefix, "").trim();
                    dfd.resolve(data);
                }
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
                    serialPort.write("i", function (err, results) {
                    });
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


    whatSerialPortDidYouMean: function (comPort, shouldPrompt, callback) {
        var that = this;

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
                if (shouldPrompt) {
                    callback(null);
                }
                return;
            }

            if (shouldPrompt && (cores.length > 0)) {
                //ask then what we meant, and try again...
                when(prompts.promptDfd(": ")).then(function (value) {
                    that.whatSerialPortDidYouMean(value, true, callback);
                });
            }
        });
    },

    _: null
});

module.exports = SerialCommand;
