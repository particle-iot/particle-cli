/*
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

var util = require('util');
var BaseCommand = require('./BaseCommand.js');
var extend = require('xtend');


/**
 * This command exists just to generate the help.
 * @param cli
 * @param options
 * @constructor
 */

var LibraryCommand = function (cli, options) {
	LibraryCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(LibraryCommand, BaseCommand);

LibraryCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: 'library',
	description: 'managemes firmware libraries',

	init: function () {
		this.addOption('install', this.dummy.bind(this), 'install');
		this.addOption('add', this.dummy.bind(this), 'add');
		this.addOption('init', this.dummy.bind(this), 'init');
		this.addOption('migrate', this.dummy.bind(this), 'migrate');
	},


	dummy: function (name) {
	},

});

module.exports = LibraryCommand;
