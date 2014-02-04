/**

 */
var when = require('when');
var pipeline = require('when/pipeline');

var sequence = require('when/sequence');
var readline = require('readline');
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var ApiClient = require('../lib/ApiClient.js');

var VariableCommand = function (cli, options) {
    VariableCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(VariableCommand, BaseCommand);
VariableCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "variable",
    description: "retrieve and monitor variables on your core",


    init: function () {
        this.addOption("list", this.listVariables.bind(this), "Show variables provided by your core(s)");
        this.addOption("get", this.getValue.bind(this), "Retrieve a value from your core");
        this.addOption("monitor", this.monitorVariables.bind(this), "Connect and display messages from a core");

        //this.addOption(null, this.helpCommand.bind(this));
    },

    getValue: function(coreid, variableName) {
        var tmp = when.defer();

        //TODO:
//        if (!args || (args.length < 1)) {
//            console.log("Please specify which core ")
//        }

        //TODO: if no device id, list devices
        //TODO: if no variable name, list variables

        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;
        when(api.getVariable(coreid, variableName)).then(
            function(result) {
                console.log(result.result);
                tmp.resolve(result.result);
            },
            function(err) {
                console.error("Error reading value ", err);
                tmp.reject(err);
            }
        );

        return tmp.promise;
    },

    listVariables: function (args) {
        var api = new ApiClient(settings.apiUrl);
        api._access_token = settings.access_token;

        var displayVariables = function(cores) {
            //sort alphabetically
            cores = cores.sort(function(a, b) {
                return (a.name || "").localeCompare(b.name);
            });

            var lines = [];
            for(var i=0;i<cores.length;i++) {
                var core = cores[i];
                var available = [];
                if (core.variables) {
                    for(var key in core.variables) {
                        var type = core.variables[key];
                        available.push("  " + key + ": " + type);
                    }
                }

                var status = core.name + " (" + core.id + ") has " + available.length + " variables ";
                if (available.length == 0) { status += " (or is offline) "; }

                lines.push(status);
                lines = lines.concat(available);
            }
            console.log(lines.join("\n"));
        };

        var lookupVariables = function(cores) {
            if (!cores || (cores.length == 0)) {
                console.log("No cores found.");
            }
            else {
                var promises = [];
                for(var i=0;i<cores.length;i++) {
                    var coreid = cores[i].id;
                    promises.push(api.getAttributes(coreid));
                }
                when.all(promises).then(displayVariables);
            }
        };

        pipeline([
            api.listDevices.bind(api),
            lookupVariables
        ]);
    },


    monitorVariables: function(coreid, variableName, delay) {
        //TODO:
//        if (!args || (args.length < 1)) {
//            console.log("Please specify which core ")
//        }

        //TODO: if no device id, list devices
        //TODO: if no variable name, list variables



        if (delay < settings.minimumApiDelay) {
            delay = settings.minimumApiDelay;
            console.log("Delay was too short, resetting to ", settings.minimumApiDelay);
        }
        console.log("Hit CTRL-C to stop!");

        var checkVariable = (function() {
            var done = this.getValue(coreid, variableName);
            when(done).ensure(function() {
                setTimeout(checkVariable, delay);
            });
        }).bind(this);
        checkVariable();
    },


    _: null
});

module.exports = VariableCommand;
