/**
 ******************************************************************************
 * @file    js/lib/utilities.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   General Utilities Module
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
var child_process = require('child_process');

var that = module.exports = {
    contains: function(arr, obj) {
        return (that.indexOf(arr, obj) >= 0);
    },
    containsKey: function(arr, obj) {
        if (!arr) {
            return false;
        }

        return that.contains(Object.keys(arr), obj);
    },
    indexOf: function(arr, obj) {
        if (!arr || (arr.length == 0)) {
            return -1;
        }

        for(var i=0;i<arr.length;i++) {
            if (arr[i] == obj) {
                return i;
            }
        }

        return -1;
    },
    pipeDeferred: function(left, right) {
        return when(left).then(function() {
            right.resolve.apply(right, arguments);
        }, function() {
            right.reject.apply(right, arguments);
        });
    },

    deferredChildProcess: function(exec) {
        var tmp = when.defer();

        console.log("running " + exec);
        child_process.exec(exec, function(error, stdout, stderr) {
            if (error) {
                tmp.reject(error);
            }
            else {
                tmp.resolve(stdout);
            }
        });

        return tmp.promise;
    },
    filenameNoExt: function (filename) {
        if (!filename || (filename.length === 0)) {
            return filename;
        }

        var idx = filename.lastIndexOf('.');
        if (idx >= 0) {
            return filename.substr(0, idx);
        }
        else {
            return filename;
        }
    },
    getFilenameExt: function (filename) {
        if (!filename || (filename.length === 0)) {
            return filename;
        }

        var idx = filename.lastIndexOf('.');
        if (idx >= 0) {
            return filename.substr(idx);
        }
        else {
            return filename;
        }
    },

    timeoutGenerator: function (msg, defer, delay) {
        return setTimeout(function () {
            defer.reject(msg);
        }, delay);
    },

    /**
     * pad the left side of "str" with "char" until it's length "len"
     * @param str
     * @param char
     * @param len
     */
    padLeft: function(str, char, len) {
        var delta = len - str.length;
        var extra = [];
        for(var i=0;i<delta;i++) {
            extra.push(char);
        }
        return extra.join("") + str;
    },

    padRight: function(str, char, len) {
        var delta = len - str.length;
        var extra = [];
        for(var i=0;i<delta;i++) {
            extra.push(char);
        }
        return str + extra.join("");
    },


    retryDeferred: function (testFn, numTries, recoveryFn) {
        if (!testFn) {
            console.error("retryDeferred - comon, pass me a real function.");
            return when.reject("not a function!");
        }

        var defer = when.defer(),
            lastError = null,
            tryTestFn = function () {
                numTries--;
                if (numTries < 0) {
                    defer.reject("Out of tries " + lastError);
                    return;
                }

                try {
                    when(testFn()).then(
                        function (value) {
                            defer.resolve(value);
                        },
                        function (msg) {
                            lastError = msg;

                            if (recoveryFn) {
                                when(recoveryFn()).then(tryTestFn);
                            }
                            else {
                                tryTestFn();
                            }
                        });
                }
                catch (ex) {
                    lastError = ex;
                }
            };

        tryTestFn();
        return defer.promise;
    },


    _:null
};