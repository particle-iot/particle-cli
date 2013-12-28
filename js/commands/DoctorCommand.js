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

var DoctorCommand = function (cli, options) {
    DoctorCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(DoctorCommand, BaseCommand);
DoctorCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "doctor",
    description: "helps repair cores, run patches, check wifi, and more!",

    init: function () {
        //this.addOption("list", this.listCores.bind(this));
        //this.addOption(null, this.helpCommand.bind(this));
    },


    _: null
});

module.exports = DoctorCommand;
