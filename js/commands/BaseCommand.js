var when = require('when');
var sequence = require('when/sequence');
var util = require('util');
var extend = require('xtend');
var readline = require('readline');


var BaseCommand = function (cli, options) {
    this.cli = cli;
    this.optionsByName = {};
    this.descriptionsByName = {};

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

    promptDfd: function (message) {
        var dfd = when.defer();
        var prompt = this.getPrompt();
        prompt.question(message, function (value) {
            dfd.resolve(value);
        });
        return dfd.promise;
    },
    passPromptDfd: function (message) {
        var dfd = when.defer();
        var prompt = this.getPrompt();

        //process.stdin.setRawMode(true);
        prompt.question(message, function (value) {
            //process.stdin.setRawMode(false);
            dfd.resolve(value);
        });
        return dfd.promise;
    },

    addOption: function (name, fn, desc) {
        this.optionsByName[name] = fn;
        this.descriptionsByName[name] = desc;
    },

    runCommand: function (args) {
        //default to wildcard
        var cmdName = "*";
        var cmdFn = this.optionsByName[cmdName];

        //or, if we have args, try to grab that command and run that instead
        if (args.length >= 1) {
            cmdName = args[0];

            if (this.optionsByName[cmdName]) {
                cmdFn = this.optionsByName[cmdName];
                args = args.slice(1);
            }
        }

        //run em if we got em.
        if (cmdFn) {
            cmdFn.apply(this, args);
        }
        else {
            //no wildcard, and no function specified...

            console.log('running help for command');
            this.cli.runCommand("help", this.name);
        }
    },


    _: null
};

module.exports = BaseCommand;