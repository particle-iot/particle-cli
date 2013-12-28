var when = require('when');
var sequence = require('when/sequence');
var util = require('util');
var extend = require('xtend');
var readline = require('readline');


var BaseCommand = function (cli, options) {
    this.cli = cli;
    this.optionsByName = {};

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

    addOption: function (name, fn) {
        this.optionsByName[name] = fn;

    },

    runCommand: function (args) {
        if (!args || args.length == 0) {
            console.log('running wildcard');
            var wild = this.optionsByName["*"];
            if (wild) {
                return wild();
            }
            else {
                console.log('running help for command');
                this.cli.runCommand("help", this.name);
            }
        }
        else if (args.length >= 1) {
            var name = args[0];
            var fn = this.optionsByName[name];
            if (fn) {
                console.log('running ' + name);
                return fn(args.slice(1));
            }
        }

    },


    _: null
};

module.exports = BaseCommand;