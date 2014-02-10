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
        this.whatSerialPortDidYouMean(comPort, function(port) {
            console.log("Opening serial monitor for com port: \"" + port + "\"");

            //TODO: listen for interrupts, close gracefully?
            var serialPort = new SerialPort(port, {
                baudrate: 9600
            });
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
                if ( (port.manufacturer && port.manufacturer.indexOf("Spark") >= 0) ||
                    (port.pnpId && port.pnpId.indexOf("Spark_Core") >= 0)
                ) {
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


    serialWifiConfig: function (serialDevicePath, ssid, pass, failDelay) {
        var dfd = when.defer();
        failDelay = failDelay || 5000;
        var failTimer = setTimeout(function () {
            dfd.reject("Serial Timed out");
        }, failDelay);

        var serialPort = this.serialPort || new SerialPort(serialDevicePath, {
            baudrate: 9600
        });

        var writeChunkIndex = 0;
        var writeChunks = [ 'w', ssid + "\n", pass + "\n" ];

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
            console.log("heard :" + data);
            chunks = [];

            if (!writeNextChunk()) {
                if (data.indexOf("Spark <3 you!") >= 0) {
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

        //serialPort.open(function () {
        writeNextChunk();
        //});

        when(dfd.promise).ensure(function () {
            serialPort.removeAllListeners("open");
            serialPort.removeAllListeners("data");
        });

        return dfd.promise;
    },

    whatSerialPortDidYouMean: function(comPort, callback) {

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

            console.log("Which core did you mean?");
            console.log("Found " + cores.length + " core(s) connected via serial: ");
            for (var i = 0; i < cores.length; i++) {
                console.log((i + 1) + ":\t" + cores[i].comName);
            }
            console.log("");
        });
    },






    identifyCore: function (comPort) {
        var that = this;
        this.whatSerialPortDidYouMean(comPort, function(port) {
            that.askForCoreID(port);
        });
    },


    askForCoreID: function (comPort) {
        var failDelay = 5000;

        var dfd = when.defer();

        try {
            //keep listening for data until we haven't received anything for...
            var boredDelay = 100,
                boredTimer,
                chunks = [];

            var serialPort = new SerialPort(comPort, {
                baudrate: 9600
            });
            this.serialPort = serialPort;


            var whenBored = function () {
                var data = chunks.join("");
                var prefix = "Your core id is ";
                data = data.replace(prefix, "").trim();
                dfd.resolve(data);
            };


            var failTimer = setTimeout(function () {
                dfd.reject("Serial Timed out");
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
    },


    _: null
});

module.exports = SerialCommand;
