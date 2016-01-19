/**
 ******************************************************************************
 * @file    commands/ExampleCommand.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Example command module
 ******************************************************************************
Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */
'use strict';

var extend = require('xtend');
var util = require('util');
var BaseCommand = require('./BaseCommand.js');

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
	}
});

module.exports = ExampleCommand;
