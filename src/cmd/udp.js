const dgram = require('dgram');


module.exports = class UdpCommands {
	sendUdpPacket({ host, port, message }) {
		const client = dgram.createSocket('udp4');
		const buf = new Buffer(message);

		console.log('Sending "' + message + '" to', host, 'at port', port);
		return new Promise((resolve, reject) => {
			client.send(buf, 0, buf.length, port, host, (err) => {
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
	}

	listenUdp({ port }) {
		port = port || 5549;

		const udpSocket = dgram.createSocket('udp4');

		udpSocket.on('listening', () => {
			console.log('Listening for UDP packets on port '+port+' ...');
		});

		udpSocket.on('message', (msg, rinfo) => {
			console.log('['+rinfo.address+'] '+msg.toString());
		});

		udpSocket.bind(port);
	}
};

