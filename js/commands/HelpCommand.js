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
        this.addOption("list", this.listCommands.bind(this), "List commands available for that command");
        this.addOption("*", this.helpCommand.bind(this), "Provide extra information about the given command");
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

    /**
     * Get more info on a specific command
     * @param name
     */
    helpCommand: function (name) {
        //console.log("Deep help command got " + name);
        //console.log("");

        if (!name) {
            this.listCommands();
            return;
        }

        var command = this.cli.findCommand(name);
        var results = [
            command.name + ":\t" + command.description,
            "the following commands are available: "
        ];
        for(var name in command.optionsByName) {
            var desc = command.descriptionsByName[name];
            var line = this.padLeft(name, " ", 15) + ":\t" + desc;
            results.push(line);
        }

        results.push("");
        results.push("");
        console.log(results.join("\n"));

    },

    listCommands: function () {
        console.log("help list commands command!");
        var commands = this.cli.getCommands();

        var results = [];
        for (var i = 0; i < commands.length; i++) {
            try {
                var c = commands[i];
                if (c.name != null) {
                    var line = c.name + ":\t\t" + c.description;
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
