var fs = require('fs');
var path = require('path');
var settings = require('../settings.js');

var Interpreter = function () {

};
Interpreter.prototype = {
    _commands: null,
    commandsByName: null,

    startup: function () {
        this.loadCommands();

    },
    handle: function (args) {
        console.log("Interpreter got args ", args);
        if (!args || args.length == 2) {
            return this.runCommand("help");
        }
        else if (args.length >= 2) {
            return this.runCommand(args[2], args.slice(3));
        }
    },

    runCommand: function(name, args) {
        console.log('looking for command ' + name);
        var c = this.commandsByName[name];
        if (c) {
            console.log("running runCommand");
            return c.runCommand(args);
        }
        else {
            console.log("Unknown command");
            return -1;
        }
    },

    getCommands: function() {
        return this._commands;
    },

    /**
     * We could make this more efficient, but this is good for a small number
     * of commands with lots of functionality
     */
    loadCommands: function() {
        this._commands = [];
        this.commandsByName = {};

        var files = fs.readdirSync(settings.commandPath);
        for (var i = 0; i < files.length; i++) {
            var cmdPath = path.join(settings.commandPath, files[i]);
            try {
                var fullPath = path.join("../", cmdPath);
                console.log('loading ' + fullPath);
                var Cmd = require(fullPath);
                var c = new Cmd(this);



                if (c.name != null) {
                    this._commands.push(c);
                    this.commandsByName[c.name] = c;
                    console.log("created a new command, ", c.name, ":", c.description);
                }
            }
            catch (ex) {
                console.error("Error loading command " + ex);
            }
        }

    },


    _: null
};
module.exports = Interpreter;