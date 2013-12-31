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

        //this.addOption(null, this.helpCommand.bind(this));
    },


    listPorts: function (args) {
        this.findCores(function (cores) {
            console.log("Found " + cores.length + " core connected via serial: ");
            for (var i = 0; i < cores.length; i++) {
                console.log((i + 1) + ":\t" + cores[i].comName);
            }
        });
    },

    monitorPort: function (args) {

        //TODO: listen for interrupts, close gracefully?

        var serialPort = new SerialPort(args[0], {
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
    },


    findCores: function (callback) {
        var cores = [];
        SerialPortLib.list(function (err, ports) {
            for (var i = 0; i < ports.length; i++) {
                var port = ports[i];

                //not trying to be secure here, just trying to be helpful.
                if (port.manufacturer.indexOf("Spark Core") >= 0) {
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

        var serialPort = that.serialPort || new SerialPort(serialDevicePath, {
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


    tryToGetCoreID: function (serialDevicePath, failDelay) {
        var dfd = when.defer();

        try {
            failDelay = failDelay || 5000;

            //keep listening for data until we haven't received anything for...
            var boredDelay = 100,
                boredTimer,
                chunks = [];

            var serialPort = new SerialPort(serialDevicePath, {
                baudrate: 9600
            });
            this.serialPort = serialPort;


            var whenBored = function () {
                var data = chunks.join("");
                console.log('data received: ' + data);

                var prefix = "Your core id is ";    //53ff6706beefef44842290187
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
        return dfd.promise;
    },


    _: null
});

module.exports = SerialCommand;
