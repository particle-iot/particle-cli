/**
 ******************************************************************************
 * @file    commands/UdpCommands.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   UDP helper commands module
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

var when = require('when');
var extend = require('xtend');
var util = require('util');
var BaseCommand = require('./BaseCommand.js');
var dgram = require('dgram');

var UdpCommands = function (cli, options) {
	UdpCommands.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(UdpCommands, BaseCommand);
UdpCommands.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: 'udp',
	description: 'helps repair devices, run patches, check Wi-Fi, and more!',

	init: function () {
		this.addOption('send', this.sendUdpPacket.bind(this), 'Sends a UDP packet to the specified host and port');
		this.addOption("listen", this.listenUdp.bind(this), 'Listens for UDP packets on an optional port (default 5549)');
		//this.addOption(null, this.helpCommand.bind(this));
	},

	sendUdpPacket: function(host, port, message) {
		if (!host || !port || !message) {
			console.error('A host, port, and message must be provided.');
			return -1;
		}

		var client = dgram.createSocket('udp4');
		var buf = new Buffer(message);

		console.log('Sending "' + message + '" to', host, 'at port', port);
		return when.promise(function(resolve, reject) {
			client.send(buf, 0, buf.length, port, host, function(err) {
				if (err) {
					console.log('error during send ' + err);
					reject();
				} else {
					console.log('Sent.');
					resolve();
				}
				client.close();
			});
		});
	},

	listenUdp: function(port) {
		if(port==undefined)
			port = 5549;

		var udpSocket = dgram.createSocket('udp4');

		udpSocket.on('listening', function() {
			console.log('Listening for UDP packets on port '+port+' ...');
		});

		udpSocket.on('message', function(msg, rinfo) {
			console.log('['+rinfo.address+'] '+msg.toString());
		});

		udpSocket.bind(port);
	}
});

module.exports = UdpCommands;