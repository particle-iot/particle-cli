module.exports = ({ commandProcessor, root }) => {
	const udp = commandProcessor.createCategory(root, 'udp', 'Talk UDP to repair devices, run patches, check Wi-Fi, and more!');

	commandProcessor.createCommand(udp, 'send', 'Sends a UDP packet to the specified host and port', {
		params: '<host> <port> <message>',
		handler: (args) => {
			const UdpCommand = require('../cmd/udp');
			return new UdpCommand().sendUdpPacket({ host: args.params.host, port: args.params.port, message: args.params.message });
		}
	});

	commandProcessor.createCommand(udp, 'listen', 'Listens for UDP packets on an optional port (default 5549)', {
		params: '[port]',
		handler: (args) => {
			const UdpCommand = require('../cmd/udp');
			return new UdpCommand(args).listenUdp({ port: args.params.port });
		}
	});

	return udp;
};

