/**
 ******************************************************************************
 * @file    commands/SubscribeCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Subscribe commands module
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


var SubscribeCommand = function (cli, options) {
	SubscribeCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(SubscribeCommand, BaseCommand);
SubscribeCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "subscribe",
	description: "helpers for watching device event streams",

	init: function () {
		this.addOption("*", this.startListening.bind(this), "Starts listening and parsing server sent events from the api to your console");
	},


	startListening: function (eventName, coreId) {
		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return;
		}

		// if they typed: "particle subscribe mine"
		if ((!coreId || (coreId == "")) && (eventName == "mine")) {
			eventName = null;
			coreId = "mine";
		}
		else if (eventName == "mine" && coreId) {
			eventName = null;
			//okay, listen to all events from this core.
		}

		var eventLabel = eventName;
		if (eventLabel) {
			eventLabel = "\"" + eventLabel + "\"";
		}
		else {
			eventLabel = "all events";
		}

		if (!coreId) {
			console.log("Subscribing to " + eventLabel + " from the firehose (all devices) ")
		}
		else if (coreId == "mine") {
			console.log("Subscribing to " + eventLabel + " from my personal stream (my devices only) ")
		}
		else {
			console.log("Subscribing to " + eventLabel + " from " + coreId + "'s stream");
		}

		var chunks = [];
		var appendToQueue = function(arr) {
			for(var i=0;i<arr.length;i++) {
				var line = (arr[i] || "").trim();
				if (line == "") {
					continue;
				}
				chunks.push(line);
				if (line.indexOf("data:") == 0) {
					processItem(chunks);
					chunks = [];
				}
			}
		};

		var processItem = function(arr) {
			var obj = {};
			for(var i=0;i<arr.length;i++) {
				var line = arr[i];

				if (line.indexOf("event:") == 0) {
					obj.name = line.replace("event:", "").trim();
				}
				else if (line.indexOf("data:") == 0) {
					line = line.replace("data:", "");
					obj = extend(obj, JSON.parse(line));
				}
			}

			console.log(JSON.stringify(obj));
		};

		var onData = function(event) {
			var chunk = event.toString();
			appendToQueue(chunk.split("\n"));
		};
		api.getEventStream(eventName, coreId, onData);

		return 0;
	},


	_: null
});

module.exports = SubscribeCommand;
