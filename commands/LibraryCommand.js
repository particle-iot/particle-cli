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

var _ = require('lodash');
var when = require('when');
var whenNode = require('when/node');
var pipeline = require('when/pipeline');
var prompt = require('inquirer').prompt;

var settings = require('../settings.js');
var BaseCommand = require('./BaseCommand.js');
var prompts = require('../oldlib/prompts.js');
var utilities = require('../oldlib/utilities.js');

var path = require('path');
var extend = require('xtend');
var util = require('util');
var chalk = require('chalk');
var inquirer = require('inquirer');

var output = require('../oldlib/output.js');

function libmgr(name) {
	return 'particle-cli-library-manager';
	// used for local development
	//return '../../cli-library-manager/lib/src/'+name;
}

var BuildLibraryRepository = require(libmgr('librepo_build')).BuildLibraryRepository;
var CloudLibraryRepository = require(libmgr('librepo_cloud')).CloudLibraryRepository;
var FileSystemLibraryRepository = require(libmgr('librepo_fs')).FileSystemLibraryRepository;


var particleApiJsConfig =
{
	baseUrl: settings.apiUrl,
	clientSecret: 'particle-api',
	clientId: 'particle-api',
	tokenDuration: 7776000 // 90 days
};


var LibraryCommand = function (cli, options) {
	LibraryCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(LibraryCommand, BaseCommand);

LibraryCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: 'library',
	description: 'management of locally installed firmware libraries',
	
	init: function () {
		this.addOption('install', this.install.bind(this), 'Installs a library to the current directory');
		this.addOption('list', this.list.bind(this), 'Displays a list of your installed libraries in the current directory');
		this.addOption('available', this.available.bind(this), 'Displays a list of libraries available.');
		this.addOption('update', this.update.bind(this), 'Updates installed libraries');
	},

	_remoteRepo: function() {
		// so evil!
		return new CloudLibraryRepository({config: particleApiJsConfig, auth: 'cf3fce66c7d84ee4ad228641680d4bfba9f63c00'});
	},

	_localRepo: function() {
		return new FileSystemLibraryRepository('./lib'); // use cwd
	},


	install: function (name) {
		if (!name) {
			console.log('Please provide the name of a library to install.');
		}
		else {
			return this._installHelper(name, this._remoteRepo(), this._localRepo());
		}
	},

	_installHelper: function (name, source, target) {
		var promise = source.fetch(name)
		.then(function(lib) {
			return target.add(lib);
		})
		.then(function() {
			console.log('library '+name+' added');
		})
		.catch(function(error) {
			console.log('Error adding library '+name);
			console.log(error);
		});
		return promise;
	},

	list: function () {
		this._listRepo(this._localRepo(), ' local libraries installed');
	},
	
	available: function () {
		this._listRepo(this._remoteRepo(), ' remote libraries available');
	},

	_listRepo: function(repo, msg) {
		return repo.names().then(function (names) {
			var lines = [];
			lines.push(names.length + msg);
			output.formatItems(names, output.stringFormatter, lines);
			output.print(lines);
		}).catch(function(error) {
			console.log(error);
		});
	},

	update: function () {
	},
	
	checkArguments: function (args) {
		this.options = this.options || {};

		if (!this.options.saveBinaryPath && (utilities.contains(args, '--saveTo'))) {
			var idx = utilities.indexOf(args, '--saveTo');
			if ((idx + 1) < args.length) {
				this.options.saveBinaryPath = args[idx + 1];
			} else {
				console.log('Please specify a file path when using --saveTo');
			}
		}
		if (!this.options.target) {
			this.options.target = utilities.tryParseArgs(args,
				'--target',
				null
			);
		}
	}
});

/*
usagesByName: {
	install: [
		[ 'particle library install neopixel', 'adds library "neopixel" from the remote repo to the current directory'],
		[ 'particle library install neopixel --dir <dir>', 'adds library "neopixel" from the remote repo to the application directory <dir>'],
	],
	list: [
		[ 'particle library list', 'lists libraries in the current directory. ],
		[ 'particle library list --dir <dir>', 'lists libraries in directory <dir>'],
		[ 'particle library list --remote', 'lists all libraries in the remote repository'],
		[ 'particle library list --remote *neo*', 'lists all libraries on the remote repo containing the word "neo"'],
	],
	update: [
		[ 'particle library update', 'updates all libraries in the current directory'],
		[ `particle library update neopixel`, `updates the neopixel library in the current directory.`]
	]
	
*/

module.exports = LibraryCommand;
