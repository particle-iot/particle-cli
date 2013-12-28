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

var FlashCommand = function (cli, options) {
    FlashCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(FlashCommand, BaseCommand);
FlashCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "flash",
    description: "copies firmware and data to your core over usb",

    init: function () {
//        this.addOption("list", this.listCommands.bind(this));
//        this.addOption(null, this.helpCommand.bind(this));
    },


    _: null
});

module.exports = FlashCommand;
