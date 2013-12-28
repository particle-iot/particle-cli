var when = require('when');
var sequence = require('when/sequence');
var util = require('util');
var extend = require('xtend');
var readline = require('readline');


var BaseCommand = function() {

};
BaseCommand.prototype = {
    /**
     * exposed by the help command
     */
    name: null,
    description: null,


    getPrompt: function () {
        if (!this._prompt) {
            this._prompt = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
        }
        return this._prompt;
    },

    addOption: function(param, fn) {

    },


    _: null
};

module.exports = BaseCommand;