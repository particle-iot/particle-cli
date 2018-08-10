const fs = require('fs');
const _ = require('lodash');
const when = require('when');
const whenNode = require('when/node');
const sequence = require('when/sequence');
const pipeline = require('when/pipeline');
const poll = require('when/poll');
const log = require('./log');

const ymodem = {
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
const ymodemLookup = _.invert(ymodem);

class YModem {
	constructor(serialPort, options) {
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
	}

	send(filenames) {
		let self = this;
		if (!_.isArray(filenames)) {
			filenames = [filenames];
		}

		let transferred = sequence([
			() => {
				return self._open(self.options.inListeningMode);
			},
			() => {
				return sequence(filenames.map((filename) => {
					// return task function
					return () => {
						console.log('sending file:', filename);
						return whenNode.lift(fs.readFile)(filename).then((buffer) => {
							return self._sendFile(buffer);
						});
					};
				}));
			},
			this._endTransfer.bind(this)
		]);

		transferred.catch((err) => {
			self.errored = true;
			return when.reject(err);
		}).finally(() => {
			self._close();
		});

		return transferred;
	}

	_logData(data) {
		if (data.length <= 2) {
			for (let i=0; i < data.length; i++) {
				let chr = data[i];
				log.verbose(ymodemLookup[chr] || chr);
			}
			return;
		}
		log.verbose(data, data.toString());
	}

	_close() {
		if (this.port.isOpen) {
			if (this.errored) {
				// ignore error here
				this.port.write([ymodem.ABORT2], () => {});
			}
			this.port.close();
		}
	}

	_open(inListeningMode) {
		let self = this;
		if (inListeningMode === undefined) {
			inListeningMode = true;
		}

		return when.promise((resolve, reject) => {
			self.port.open((err) => {
				if (err) {
					return reject(err);
				}

				// wait for initial response
				let line = '';
				function cmdResponse() {
					let data = self.port.read();
					self._logData(data);
					line += data.toString();
					// if not in listening mode, we get CRC16 back
					// if in listening mode, we get this string
					if (data[0] === ymodem.CRC16 || line.trim() === "Waiting for the binary file to be sent ... (press 'a' to abort)") {
						self.port.removeListener('readable', cmdResponse);
						return resolve();
					}
				}
				self.port.on('readable', cmdResponse);
				self.port.write('f');
			});
		}).timeout(10000).catch(when.TimeoutError, () => {
			return when.reject('Timed out waiting for initial response from device');
		});
	}

	_endTransfer() {
		this.seq = 0;
		this.ending = true;
		return this._sendFileHeader('', 0);
	}

	_sendFile(buffer) {
		let self = this;
		this.seq = 0;
		return pipeline([
			() => {
				log.verbose('send file header');
				return self._sendFileHeader('binary', buffer.length);
			},
			(fileResponse) => {
				if (fileResponse !== ymodem.ACK) {
					return when.reject('file header not acknowledged');
				}

				// keep sending packets until we are done
				return poll(() => {
					let start = (self.seq - 1) * self.options.packetLength;
					let buf = buffer.slice(start, start + self.options.packetLength);
					return self._sendPacket(buf);
				}, 1, () => {
					return ((self.seq - 1) * self.options.packetLength) >= buffer.length;
				});
			},
			() => {
				let buf = new Buffer([ymodem.EOT]);
				log.verbose('write', self.seq, buf, buf.length);
				return self._sendRawPacket(buf);
			}
		]);
	}

	_sendFileHeader(name, length) {
		let buf = new Buffer(name + '\0' + length + ' ');
		return this._sendPacket(buf);
	}

	_sendPacket(packet) {
		if (packet.length < this.options.packetLength) {
			let filler = new Buffer(this.options.packetLength - packet.length);
			filler.fill(0);
			packet = Buffer.concat([packet, filler], this.options.packetLength);
		}

		let seqchr = this.seq & 0xFF;
		let seqchrNeg = (-this.seq - 1) & 0xFF;
		let header = new Buffer([this.mark, seqchr, seqchrNeg]);
		let crc16 = new Buffer([0, 0]);
		packet = Buffer.concat([header, packet, crc16]);
		log.verbose('write', this.seq, header, packet.length);

		return this._sendRawPacket(packet);
	}

	_sendRawPacket(packet) {
		let self = this;
		let response = when.promise((resolve, reject) => {
			let resp = new Buffer([]);
			function writeResponse() {
				let data = self.port.read();
				self._logData(data);
				resp = Buffer.concat([resp, data]);
				switch (resp[0]) {
					case ymodem.ACK:
						if (!self.ending && self.seq === 0 && resp.length < 2) {
							// on first ACK we expect a CRC16 afterwards
							return;
						}
						self.seq += 1;
						self.port.removeListener('readable', writeResponse);
						resolve(resp[0]);
						break;
					case ymodem.CA:
						if (resp.length < 2) {
							// expect two CAs
							return;
						}
						// fallthrough on purpose
					case ymodem.NAK:
						self.port.removeListener('readable', writeResponse);
						reject('Transfer cancelled');
						break;
					default:
						self.port.removeListener('readable', writeResponse);
						reject('unknown message');
						break;
				}
			}
			self.port.on('readable', writeResponse);
		});

		return pipeline([
			() => {
				return whenNode.lift(self.port.write.bind(self.port))(packet);
			},
			() => {
				return response.timeout(10000);
			}
		]);
	}
}

module.exports = YModem;
