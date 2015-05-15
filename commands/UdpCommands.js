/**
 ******************************************************************************
 * @file    commands/UdpCommands.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   UDP helper commands module
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
var readline = require('readline');
var fs = require('fs');
var settings = require('../settings.js');
var path = require('path');

var extend = require('xtend');
var util = require('util');
var BaseCommand = require("./BaseCommand.js");
var dgram = require('dgram');


var UdpCommands = function (cli, options) {
	UdpCommands.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(UdpCommands, BaseCommand);
UdpCommands.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "udp",
	description: "helps repair devices, run patches, check Wi-Fi, and more!",

	init: function () {
		this.addOption("send", this.sendUdpPacket.bind(this), "Sends a UDP packet to the specified host and port");
		//this.addOption("listen", this.sendUdpPacket.bind(this), "");
		//this.addOption(null, this.helpCommand.bind(this));
	},

	sendUdpPacket: function(host, port, message) {

		var client = dgram.createSocket("udp4");
		var buf = new Buffer(message);

		console.log("Sending \"" + message + "\" to ", host, " at port ", port);
		client.send(buf, 0, buf.length, port, host, function(err, bytes) {
			if (err) {
				console.log("error during send " + err);
			}

			console.log("Sent.");
			client.close();
		});

	},


	_: null
});

module.exports = UdpCommands;
