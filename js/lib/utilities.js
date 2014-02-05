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
        when(left).then(function() {
            right.resolve.apply(right, arguments);
        }, function() {
            right.reject.apply(right, arguments);
        })
    },

    deferredChildProcess: function(exec) {
        var tmp = when.defer();
        child_process.exec("openssl genrsa -out core.pem 1024", function(error, stdout, stderr) {
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


    _:null
};