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

var ExampleCommand = function (cli, options) {
    ExampleCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(ExampleCommand, BaseCommand);
ExampleCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    //name: "example",
    //description: "example description to show in help",

    init: function () {
        //this.addOption("list", this.listCores.bind(this));
        //this.addOption(null, this.helpCommand.bind(this));
    },


    _: null
});

module.exports = ExampleCommand;
