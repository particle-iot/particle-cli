const _ = require('lodash');
const {
	readFile,
	delay,
	asyncMapSeries,
	enforceTimeout
} = require('./utilities');
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


module.exports = class YModem {
	constructor(serialPort, options){
		this.options = _.defaults(options, {
			packetLength: 128,
			debug: false,
			inListeningMode: true
		});
		this.port = serialPort;

		if (this.options.packetLength === 128){
			this.mark = ymodem.SOH;
		} else if (this.options.packetLength === 1024){
			this.mark = ymodem.STX;
		} else {
			throw new Error('invalid packet length');
		}

		serialPort.once('close', this._close.bind(this));
	}

	send(filenames){
		let self = this;

		if (!_.isArray(filenames)){
			filenames = [filenames];
		}

		return this._open(this.options.inListeningMode)
			.then(() => {
				return asyncMapSeries(filenames, (filename) => {
					console.log('sending file:', filename);
					return readFile(filename)
						.then((buffer) => self._sendFile(buffer));
				});
			})
			.then(() => this._endTransfer())
			.catch((err) => {
				self.errored = true;
				return Promise.reject(err);
			})
			.finally(() => self._close());
	}

	_logData(data){
		if (data.length <= 2){
			for (let i=0; i < data.length; i++){
				let chr = data[i];
				log.verbose(ymodemLookup[chr] || chr);
			}
			return;
		}
		log.verbose(data, data.toString());
	}

	_close(){
		if (this.port.isOpen){
			if (this.errored){
				// ignore error here
				this.port.write([ymodem.ABORT2], () => {});
			}
			this.port.close();
		}
	}

	_open(inListeningMode){
		let self = this;

		if (inListeningMode === undefined){
			inListeningMode = true;
		}

		const promise = new Promise((resolve, reject) => {
			self.port.open((err) => {
				if (err){
					return reject(err);
				}

				// wait for initial response
				let line = '';
				function cmdResponse(){
					let data = self.port.read();
					self._logData(data);
					line += data.toString();
					// if not in listening mode, we get CRC16 back
					// if in listening mode, we get this string
					if (data[0] === ymodem.CRC16 || line.trim() === "Waiting for the binary file to be sent ... (press 'a' to abort)"){
						self.port.removeListener('readable', cmdResponse);
						return resolve();
					}
				}
				self.port.on('readable', cmdResponse);
				self.port.write('f');
			});
		});

		return enforceTimeout(promise, 10000)
			.catch((error) => {
				if (error && error.isTimeout){
					return Promise.reject('Timed out waiting for initial response from device');
				}
				throw error;
			});
	}

	_endTransfer(){
		this.seq = 0;
		this.ending = true;
		return this._sendFileHeader('', 0);
	}

	_sendFile(buffer){
		let self = this;
		this.seq = 0;

		return Promise.resolve()
			.then(() => {
				log.verbose('send file header');
				return self._sendFileHeader('binary', buffer.length);
			})
			.then((fileResponse) => {
				if (fileResponse !== ymodem.ACK){
					return Promise.reject('file header not acknowledged');
				}

				let lastValue;
				async function send(){
					let start = (self.seq - 1) * self.options.packetLength;
					let buf = buffer.slice(start, start + self.options.packetLength);

					lastValue = await self._sendPacket(buf);

					if (isDone()){
						return lastValue;
					}

					await delay(1);
					return send();
				}

				function isDone(){
					return ((self.seq - 1) * self.options.packetLength) >= buffer.length;
				}

				return send();
			})
			.then(() => {
				let buf = new Buffer([ymodem.EOT]);
				log.verbose('write', self.seq, buf, buf.length);
				return self._sendRawPacket(buf);
			});
	}

	_sendFileHeader(name, length){
		let buf = new Buffer(name + '\0' + length + ' ');
		return this._sendPacket(buf);
	}

	_sendPacket(packet){
		if (packet.length < this.options.packetLength){
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

	_sendRawPacket(packet){
		const self = this;
		const response = new Promise((resolve, reject) => {
			let resp = new Buffer([]);
			function writeResponse(){
				let data = self.port.read();

				self._logData(data);
				resp = Buffer.concat([resp, data]);

				switch (resp[0]){
					case ymodem.ACK:
						if (!self.ending && self.seq === 0 && resp.length < 2){
							// on first ACK we expect a CRC16 afterwards
							return;
						}
						self.seq += 1;
						self.port.removeListener('readable', writeResponse);
						resolve(resp[0]);
						break;
					case ymodem.CA:
						if (resp.length < 2){
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
		const writeToPort = new Promise((resolve, reject) => {
			self.port.write(packet, (error) => {
				if (error){
					return reject(error);
				}
				return resolve();
			});
		});

		return writeToPort
			.then(() => enforceTimeout(response, 70000));
	}
};

