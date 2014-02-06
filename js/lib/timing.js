var when = require('when');
var logger = require('./logger.js');

var that = module.exports = {
    helpers: {

        waitFor: function (delay) {
            return function () {
                var temp = when.defer();
                logger.log('.(delay:' + delay + ').');
                setTimeout(function () { temp.resolve(); }, delay);
                return temp.promise;
            };
        },

        waitASecond: function () {
            var temp = when.defer();
            logger.log('..');
            setTimeout(function () { temp.resolve(); }, 1000);
            return temp.promise;
        },
        waitHalfSecond: function () {
            var temp = when.defer();
            logger.log('.');
            setTimeout(function () { temp.resolve(); }, 500);
            return temp.promise;
        },
        waitFOREVER: function () {
            var temp = when.defer();
            logger.log(
                '--------------------------------------------------------------------\n' +
                'WAITING FOREVER\n' +
                '--------------------------------------------------------------------\n'
            );
            return temp.promise;
        }
    }
};
