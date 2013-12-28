/**

 */

var when = require('when');
var sequence = require('when/sequence');
var readline = require('readline');
var fs = require('fs');
var settings = require('../settings.js');
var path = require('path');

var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");

var HelpCommand = function (options) {
    this.super_(options);
    this.options = extend({}, this.options, options);

    this.init();
};
HelpCommand.prototype = {
    options: null,
    name: "help",
    description: "Help provides information on available commands in the cli",


    init: function () {
        this.addOption("list", this.listCommands.bind(this));
        this.addOption(null, this.helpCommand.bind(this));
    },

    helpCommand: function (name) {


    },

    listCommands: function () {
        var files = fs.readdirSync(settings.commandPath);
        var results = [];
        for (var i = 0; i < files.length; i++) {
            var cmdPath = path.join(settings.commandPath, files[i]);
            try {
                var Cmd = require(cmdPath);
                var c = new Cmd();

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
};
util.inherits(HelpCommand, BaseCommand.prototype);
module.exports = HelpCommand;
