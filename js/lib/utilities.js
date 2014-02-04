var when = require('when');

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
    }


};