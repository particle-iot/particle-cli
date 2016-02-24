'use strict';

var fs = require('fs');
var _ = require('lodash');
var when = require('when');
var whenNode = require('when/node');
var sequence = require('when/sequence');
var pipeline = require('when/pipeline');
var poll = require('when/poll');
var log = require('./log');

var ymodem = {
	// 128 byte blocks
	SOH: 0x01,
	// 1024 byte blocks
	STX: 0x02,
	EOT: 0x04,
	ACK: 0x06,
	NAK: 0x15,
	CA: 0x18,
	CRC16: 0x43,
	ABORT1: 0x41,
	ABORT2: 0x61
};
var ymodemLookup = _.invert(ymodem);

function YModem(serialPort, options) {
	this.options = _.defaults(options, {
		packetLength: 128,
		debug: false,
		inListeningMode: true
	});
	this.port = serialPort;

	if (this.options.packetLength === 128) {
		this.mark = ymodem.SOH;
	} else if (this.options.packetLength === 1024) {
		this.mark = ymodem.STX;
	} else {
		throw new Error('invalid packet length');
	}

	serialPort.once('close', this._close.bind(this));

	serialPort.once('open', function() {
		serialPort.on('data', function(data) {
			if (data.length <= 2) {
				for (var i=0; i < data.length; i++) {
					var chr = data[i];
					log.verbose(ymodemLookup[chr] || chr);
				}
				return;
			}
			log.verbose(data, data.toString());
		});
	});
}

YModem.prototype = {
	send: function(filenames) {
		var self = this;
		if (!_.isArray(filenames)) {
			filenames = [filenames];
		}

		var transferred = sequence([
			function() {
				return self._open(self.options.inListeningMode);
			},
			function() {
				return sequence(filenames.map(function (filename) {
					// return task function
					return function() {
						console.log('sending file:', filename);
						return whenNode.lift(fs.readFile)(filename).then(function(buffer) {
							return self._sendFile(buffer);
						});
					};
				}));
			},
			this._endTransfer.bind(this)
		]);

		transferred.catch(function(err) {
			this.errored = true;
			return when.reject(err);
		}).finally(function() {
			self._close();
		});

		return transferred;
	},

	_close: function() {
		if (this.port.isOpen()) {
			if (this.errored) {
				// ignore error here
				this.port.write([ymodem.ABORT2], function() {});
			}
			this.port.close();
		}
	},

	_open: function(inListeningMode) {
		var self = this;
		if (inListeningMode === undefined) {
			inListeningMode = true;
		}

		return when.promise(function(resolve, reject) {
			self.port.open(function(err) {
				if (err) {
					return reject(err);
				}

				// wait for initial response
				var line = '';
				function cmdResponse(data) {
					line += data.toString();
					// if not in listening mode, we get CRC16 back
					// if in listening mode, we get this string
					if (data[0] === ymodem.CRC16 || line.trim() === "Waiting for the binary file to be sent ... (press 'a' to abort)") {
						self.port.removeListener('data', cmdResponse);
						return resolve();
					}
				}
				self.port.on('data', cmdResponse);
				self.port.write('f');
			});
		}).timeout(5000).catch(when.TimeoutError, function() {
			return when.reject('Timed out waiting for initial response from device');
		});
	},

	_endTransfer: function() {
		this.seq = 0;
		this.ending = true;
		return this._sendFileHeader('', 0);
	},

	_sendFile: function(buffer) {
		var self = this;
		this.seq = 0;
		return pipeline([
			function() {
				log.verbose('send file header');
				return self._sendFileHeader('binary', buffer.length);
			},
			function(fileResponse) {
				if (fileResponse !== ymodem.ACK) {
					return when.reject('file header not acknowledged');
				}

				// keep sending packets until we are done
				return poll(function() {
					var start = (self.seq - 1) * self.options.packetLength;
					var buf = buffer.slice(start, start + self.options.packetLength);
					return self._sendPacket(buf);
				}, 1, function() {
					return ((self.seq - 1) * self.options.packetLength) >= buffer.length;
				});
			},
			function() {
				var buf = new Buffer([ymodem.EOT]);
				log.verbose('write', self.seq, buf, buf.length);
				return self._sendRawPacket(buf);
			}
		]);
	},

	_sendFileHeader: function(name, length) {
		var buf = new Buffer(name + '\0' + length + ' ');
		return this._sendPacket(buf);
	},

	_sendPacket: function(packet) {
		if (packet.length < this.options.packetLength) {
			var filler = new Buffer(this.options.packetLength - packet.length).fill(0);
			packet = Buffer.concat([packet, filler], this.options.packetLength);
		}

		var seqchr = this.seq & 0xFF;
		var seqchr_neg = (-this.seq - 1) & 0xFF;
		var header = new Buffer([this.mark, seqchr, seqchr_neg]);
		var crc16 = new Buffer([0, 0]);
		packet = Buffer.concat([header, packet, crc16]);
		log.verbose('write', this.seq, header, packet.length);

		return this._sendRawPacket(packet);
	},

	_sendRawPacket: function(packet) {
		var self = this;
		var response = when.promise(function(resolve, reject) {
			var resp = new Buffer([]);
			function writeResponse(data) {
				log.verbose('response', data);
				resp = Buffer.concat([resp, data]);
				switch (resp[0]) {
					case ymodem.ACK:
						if (!self.ending && self.seq === 0 && resp.length < 2) {
							// on first ACK we expect a CRC16 afterwards
							return;
						}
						self.seq += 1;
						self.port.removeListener('data', writeResponse);
						resolve(resp[0]);
						break;
					case ymodem.CA:
						if (resp.length < 2) {
							// expect two CAs
							return;
						}
						// fallthrough on purpose
					case ymodem.NAK:
						self.port.removeListener('data', writeResponse);
						reject('Transfer cancelled');
						break;
					default:
						self.port.removeListener('data', writeResponse);
						reject('unknown message');
						break;
				}
			}
			self.port.on('data', writeResponse);
		});

		return pipeline([
			whenNode.lift(self.port.flush.bind(self.port)),
			function() {
				return whenNode.lift(self.port.write.bind(self.port))(packet);
			},
			function() {
				return response.timeout(10000);
			}
		]);
	}
};

module.exports = YModem;
