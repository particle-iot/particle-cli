/**
 ******************************************************************************
 * @file    commands/PublishCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Publish commands module
 ******************************************************************************
Copyright (c) 2014 Spark Labs, Inc.  All rights reserved.

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
 
var when = require('when');
var sequence = require('when/sequence');

var settings = require('../settings.js');
var path = require('path');
var extend = require('xtend');
var util = require('util');
var fs = require('fs');

var BaseCommand = require("./BaseCommand.js");
var ApiClient = require('../lib/ApiClient.js');


var PublishCommand = function (cli, options) {
	PublishCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(PublishCommand, BaseCommand);
PublishCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "publish",
	description: "This feature is in a limited beta, and is not yet generally available",

	init: function () {
		this.addOption("*", this.publishEvent.bind(this), "Publishes an event to the cloud");
	},


	publishEvent: function (eventName, data) {
		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return -1;
		}

		if (!eventName) {
			console.log("Please specify an event name");
			return -1;
		}

		api.publishEvent(eventName, data);

		return 0;
	},


	_: null
});

module.exports = PublishCommand;
