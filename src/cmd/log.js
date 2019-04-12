const ParticleApi = require('./api').default;
const { openUsbDevice, openUsbDeviceById } = require('./usb-util');
const { prompt, spin } = require('../app/ui');
const deviceSpecs = require('../lib/deviceSpecs');

const SerialPort = require('serialport');
const chalk = require('chalk');
const when = require('when');

const EventEmitter = require('events');

// USB vedor/product IDs of the Particle devices in the CDC mode
const PARTICLE_USB_IDS = Object.values(deviceSpecs).reduce((set, spec) => {
	return set.add(`${spec.serial.vid}:${spec.serial.pid}`.toLowerCase()); // vid:pid
}, new Set());

const STREAM_TYPES = [
	{
		name: 'Serial',
		isUsbSerial: true
	},
	{
		name: 'USBSerial1',
		isUsbSerial: true
	},
	{
		name: 'Serial1'
	}
];

const LOG_LEVELS = ['all', 'trace', 'info', 'warn', 'error', 'none'];

const DEFAULT_STREAM = 'Serial';
const DEFAULT_BAUD_RATE = 115200;
const DEFAULT_LOG_LEVEL = 'all';

const CATEGORY_FIELD_WIDTH = 14;

class PrettyFormatter extends EventEmitter {
	constructor() {
		super();
		this._buf = '';
	}

	update(data) {
		this._buf += data.toString('ascii');
		for (;;) {
			const r = this._findJsonObject(this._buf);
			if (!r.valid) {
				this._buf = '';
				break; // The buffer doesn't contain JSON objects
			}
			if (!r.complete) {
				break; // Wait for more input
			}
			let msg = this._buf.slice(r.startIndex, r.endIndex);
			this._buf = this._buf.slice(r.endIndex);
			try {
				msg = JSON.parse(msg);
			} catch (e) {
				continue; // Not a valid JSON document
			}
			if (!msg.l || !msg.t) {
				continue; // Not a log message
			}
			msg = this._formatMessage(msg);
			this.emit('data', msg);
		}
	}

	_formatMessage(msg) {
		let m = this._formatText(msg.m);
		switch (msg.l) {
			case 't': // Trace
				m = chalk.dim(m);
				break;
			case 'w': // Warning
				m = chalk.yellow.bold(m);
				break;
			case 'e': // Error
				m = chalk.red.bold(m);
				break;
		}
		const t = this._formatTimestamp(msg.t);
		const c = this._formatCategory(msg.c);
		return `${chalk.dim(t)} ${chalk.dim(':')} ${chalk.dim(c)} ${chalk.dim(':')} ${m}\n`;
	}

	_formatText(m) {
		// TODO: Split long messages into multiple lines depending on the terminal width
		return m;
	}

	_formatTimestamp(t) {
		const totalSec = Math.floor(t / 1000);
		const totalMin = Math.floor(totalSec / 60);
		const msec = (t % 1000).toString().padStart(3, '0');
		const sec = (totalSec % 60).toString().padStart(2, '0');
		const min = (totalMin % 60).toString().padStart(2, '0');
		const hr = Math.floor(totalMin / 60).toString().padStart(2, '0');
		return `${hr}:${min}:${sec}.${msec}`;
	}

	_formatCategory(c) {
		if (!c) {
			c = '';
		}
		if (c.length > CATEGORY_FIELD_WIDTH) {
			c = c.slice(0, CATEGORY_FIELD_WIDTH - 1);
			if (c.charAt(c.length - 1) === '.') {
				c = c.slice(0, c.length - 1);
			}
			c += '~';
		}
		c = c.padEnd(CATEGORY_FIELD_WIDTH, ' ');
		return c;
	}

	// Finds a substring that looks like a valid JSON object
	_findJsonObject(srcStr) {
		const br = [];
		let start = null;
		let esc = false;
		let str = false;
		let i = 0;
		for (; i < srcStr.length; ++i) {
			const c = srcStr.charAt(i);
			if (!str) {
				if (c === '{') {
					br.push(c);
					if (start === null) {
						start = i; // Beginning of a JSON object
					}
				} if (start !== null) { // Keep skipping characters until the first '{' is found
					if (c === '[') {
						br.push(c);
					} else if (c === '}' || c === ']') {
						const c1 = br.pop();
						if ((c === '}' && c1 !== '{') || (c === ']' && c1 !== '[')) {
							return { valid: false }; // Invalid closing bracket
						}
						if (br.length === 0) {
							break; // End of the JSON object
						}
					} else if (c === '"') {
						str = true; // Beginning of a string
					}
				}
			} else if (esc) {
				esc = false; // Ignore the escaped character
			} else if (c === '\\') {
				esc = true; // Beginning of an escaped character
			} else if (c === '"') {
				str = false; // End of the string
			}
		}
		if (i === srcStr.length) {
			if (start === null) {
				return { valid: false }; // The string doesn't contain a '{' character
			}
			return {
				valid: true,
				complete: false, // Found an incomplete JSON object
				startIndex: start
			};
		}
		return {
			valid: true,
			complete: true,
			startIndex: start,
			endIndex: i + 1
		};
	}
}

function findStreamType(streamName) {
	const name = streamName.toLowerCase();
	const stream = STREAM_TYPES.find(s => s.name.toLowerCase() === name);
	if (!stream) {
		throw new Error(`Unknown stream type: ${streamName}`);
	}
	return stream;
}

function parseLogLevel(levelStr) {
	const str = levelStr.toLowerCase();
	const level = LOG_LEVELS.find(l => l.startsWith(str));
	if (!level) {
		throw new Error(`Invalid log level: ${levelStr}`);
	}
	return level;
}

function handlerIdForStreamType(streamType) {
	return `__cli_${streamType.name}`;
}

function isParticleSerialPort(port) {
	if (!port.vendorId || !port.productId) {
		return false;
	}
	const s = `${port.vendorId}:${port.productId}`.toLowerCase();
	return PARTICLE_USB_IDS.has(s);
}

module.exports = class LogCommand {
	constructor(settings) {
		this._auth = settings.access_token;
		this._api = new ParticleApi(settings.apiUrl, { accessToken: this._auth }).api;
	}

	run(args) {
		let streamType = null;
		let defaultLevel = null;
		let filters = null;
		let baudRate = null;
		let usbDevice = null;
		let serialPort = null;
		let deviceId = null;
		let handlerId = null;
		let handlerEnabled = false;
		return when.resolve().then(() => {
			// Parse arguments
			streamType = findStreamType(args.params.stream || DEFAULT_STREAM);
			defaultLevel = args.level ? parseLogLevel(args.level) : DEFAULT_LOG_LEVEL;
			filters = this._parseFilters(args);
			baudRate = args.baud || DEFAULT_BAUD_RATE;
			// Open the device
			return openUsbDeviceById({ id: args.params.device, api: this._api, auth: this._auth });
		})
		.then(dev => {
			// Enable logging
			usbDevice = dev;
			deviceId = usbDevice.id;
			handlerId = handlerIdForStreamType(streamType);
			const p = usbDevice.addLogHandler({
				id: handlerId,
				format: args.raw ? 'default' : 'json',
				stream: streamType.name,
				level: defaultLevel,
				filters: filters,
				baudRate: baudRate
			})
			.then(() => {
				handlerEnabled = true;
				return usbDevice.close();
			});
			return spin(p, 'Configuring the device...');
		})
		.then(() => {
			// Get the serial port assigned to the device
			if (args.params.serial_port) {
				return args.params.serial_port;
			}
			return this._findSerialPort(streamType, deviceId);
		})
		.then(portName => {
			// Open serial port
			return when.promise((resolve, reject) => {
				console.error(`Opening serial port: ${portName}`);
				const port = new SerialPort(portName, { baudRate }, err => {
					if (err) {
						return reject(err);
					}
					resolve(port);
				});
			});
		})
		.then(port => {
			serialPort = port;
			// TODO: Try to reopen the serial port and re-register the log handler on USB/serial port errors
			const p = when.promise((resolve, reject) => {
				serialPort.on('error', err => reject(err));
				serialPort.on('close', err => err ? reject(err) : resolve());
			});
			// Close the serial port on Ctrl-C
			let closing = false;
			const signalHandler = () => {
				if (!closing) {
					closing = true;
					console.error('\nClosing the device...');
					serialPort.close();
				} else {
					// Terminate the process on second Ctrl-C
					console.error('\nAborted.');
					process.exit(1);
				}
			};
			process.on('SIGINT', signalHandler);
			process.on('SIGTERM', signalHandler);
			// Start reading the logging output
			console.error('Press Ctrl-C to exit.');
			let log = serialPort;
			if (!args.raw) {
				log = new PrettyFormatter();
				serialPort.on('data', d => log.update(d));
			}
			log.on('data', d => process.stdout.write(d));
			return p;
		})
		.finally(() => {
			if (serialPort) {
				// Close the serial port
				return when.promise((resolve, reject) => {
					serialPort.close(() => resolve()); // Ignore errors
				});
			}
		})
		.finally(() => {
			if (usbDevice && handlerEnabled) {
				// Unregister the log handler
				return openUsbDevice(usbDevice)
					.then(() => usbDevice.removeLogHandler({ id: handlerId }))
					.catch(e => {}); // Ignore errors
			}
		})
		.finally(() => {
			if (usbDevice) {
				// Close the USB device
				return usbDevice.close()
					.catch(e => {}); // Ignore errors
			}
		})
		.then(() => {
			console.error('Done.');
		});
	}

	_findSerialPort(streamType, deviceId) {
		return when.resolve().then(() => {
			return SerialPort.list();
		})
		.then(ports => {
			if (streamType.isUsbSerial) {
				// Get all USB serial ports with a matching serial number
				// TODO: Check the interface index to identify ports assigned to Serial and USBSerial1
				ports = ports.filter(p => p.serialNumber && p.serialNumber.toLowerCase() === deviceId);
			} else {
				// Filter out all Particle and non-USB serial ports
				// FIXME: This will likely filter out built-in UARTs on Raspberry Pi
				ports = ports.filter(p => p.vendorId && p.productId && !isParticleSerialPort(p));
			}
			if (ports.length === 0) {
				throw new Error('Serial port is not found');
			}
			if (ports.length === 1) {
				return ports[0].comName;
			}
			// Let the user identify the serial port
			return prompt({
				name: 'port',
				type: 'list',
				message: `Please specify the serial port assigned to ${streamType.name}`,
				choices: ports.map(p => p.comName)
			})
			.then(r => r.port);
		});
	}

	_parseFilters(args) {
		args = args.filter;
		if (!args) {
			return null;
		}
		if (typeof args === 'string') {
			args = [args];
		}
		return args.map(arg => {
			const s = arg.split(':'); // category:level
			if (s.length > 2 || !s[0] || (s.length === 2 && !s[1])) {
				throw new Error('Invalid filter string');
			}
			const f = {
				category: s[0]
			};
			if (s.length === 2) {
				f.level = parseLogLevel(s[1]);
			} else {
				f.level = DEFAULT_LOG_LEVEL;
			}
			return f;
		});
	}
};
