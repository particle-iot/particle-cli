/**

 */

var when = require('when');
var sequence = require('when/sequence');
var readline = require('readline');




var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");

var HelpCommand = function (cli, options) {
    HelpCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(HelpCommand, BaseCommand);
HelpCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "help",
    description: "Help provides information on available commands in the cli",


    init: function () {
        this.addOption("list", this.listCommands.bind(this));
        this.addOption("*", this.helpCommand.bind(this));
    },


    /**
     * Get more info on a specific command
     * @param name
     */
    helpCommand: function (name) {
        console.log("Deep help command!");

    },

    listCommands: function () {
        console.log("list commands command!");
        var commands = this.cli.getCommands();

        var results = [];
        for (var i = 0; i < commands.length; i++) {
            try {
                var c = commands[i];
                if (c.name != null) {
                    var line = c.name + ": " + c.description;
                    results.push(line);
                }
            }
            catch (ex) {
                console.error("Error loading command " + ex);
            }
        }

        console.log(results.join("\n"));
    },

    _: null
});

module.exports = HelpCommand;
