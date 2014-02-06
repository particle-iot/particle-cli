var fs = require('fs');
var when = require('when');
var sequence = require('when/sequence');
var timing = require('./timing.js');
var utilities = require('./utilities.js');
var child_process = require('child_process');
var settings = require('../settings.js');

var that = module.exports = {

    deviceID: '1d50:607f',
    checkFor: [
        '1d50:607f'
    ],

    findCompatiableDFU: function () {
        var temp = when.defer();

        var failTimer = utilities.timeoutGenerator("findCompatiableDFU timed out", temp, 5000);
        child_process.exec("dfu-util -l", function (error, stdout, stderr) {
            clearTimeout(failTimer);

            for (var i = 0; i < that.checkFor.length; i++) {
                var id = that.checkFor[i];
                if (stdout.indexOf(id) >= 0) {
                    console.log("FOUND DFU DEVICE " + id);
                    that.deviceID = id;
                    temp.resolve();
                    return;
                }
            }

            console.log("Apparently I didn't find a DFU device? util said ", stdout);
            temp.reject("no dfu device found.");
        });

        return temp.promise;
    },



    writeServerKey: function(binaryPath, leave) {
        return that.writeDfu(1, binaryPath, "0x00001000", leave);
    },
    writePrivateKey: function(binaryPath, leave) {
        return that.writeDfu(1, binaryPath, "0x00002000", leave);
    },
    writeFactoryReset: function(binaryPath, leave) {
        return that.writeDfu(1, binaryPath, "0x00020000", leave);
    },
    writeFirmware: function(binaryPath, leave) {
        return that.writeDfu(0, binaryPath, "0x08005000", leave);
    },


    writeDfu: function (memoryInterface, binaryPath, firmwareAddress, leave) {
        console.log('programOverDFU');

        var tryProgrammingOverUsb = function () {
            var temp = when.defer();
            try {
                var failTimer = setTimeout(function () {
                    //if we don't hear back from the core in some reasonable amount of time, fail.
                    temp.reject("programOverDFU: never heard back?");
                }, 20000);

                var prefix = that.getCommandPrefix();
                var leaveStr = (leave) ? ":leave" : "";

                var cmd = prefix + ' -a ' + memoryInterface + ' -s ' + firmwareAddress + leaveStr + ' -D ' + binaryPath;
                that.checkBinaryAlignment(cmd);

                console.log("programOverDFU running: " + cmd);
                child_process.exec(cmd, function (error, stdout, stderr) {
                    clearTimeout(failTimer);

                    console.log("programOverDFU dfu done !", error, stdout, stderr);

                    if (error) {
                        temp.reject("programOverDFU: " + error);
                        console.log("programOverDFU stdout: " + stdout);
                        console.log("programOverDFU stderr: " + stderr);
                    }
                    else {
                        console.log("programOverDFU success!");
                        temp.resolve();
                    }
                });
            }
            catch (ex) {
                console.error("programOverDFU error: " + ex);
                temp.reject("programOverDFU error: " + ex);
            }

            return temp.promise;
        };

        var promise = sequence([
            that.findCompatiableDFU,
            timing.helpers.waitHalfSecond,
            tryProgrammingOverUsb
        ]);

        return promise;
    },


    getCommandPrefix: function () {
        return "sudo dfu-util -d " + that.deviceID;
    },

    checkBinaryAlignment: function (cmdargs) {
        var idx = cmdargs.indexOf('-D ');
        if (idx >= 0) {
            var filepath = cmdargs.substr(idx + 3);
            console.log('checking file ', filepath);
            that.appendToEvenBytes(filepath);
        }
        else {
            console.log('uhh, args had no path.');
        }
    },

    /**
     *
     * @param filepath
     */
    appendToEvenBytes: function (filepath) {
        if (fs.existsSync(filepath)) {
            var stats = fs.statSync(filepath);

            //is the filesize even?
            //console.log(filepath, ' stats are ', stats);
            if ((stats.size % 2) != 0) {
                var buf = new Buffer(1);
                buf[0] = 0;

                fs.appendFileSync(filepath, buf);
            }
        }
    },

    _: null
};