'use strict';
const net = require('net');
const nock = require('nock');

const PROXY_ENV_VARS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'NO_PROXY', 'no_proxy'];

/**
 * Start a fake HTTP proxy on localhost that records the first request line
 * it receives (e.g. `CONNECT binaries.particle.io:443 HTTP/1.1`) and then
 * answers `502 Bad Gateway`, like a real proxy that can't reach the target.
 *
 * While it runs, HTTPS_PROXY points at it and nock is deactivated so the
 * request really reaches the proxy. Nothing leaves the machine: the proxy
 * never forwards anything.
 *
 * It lets tests check that an outbound request is routed through the proxy
 * configured in the environment, independently of which HTTP client library
 * makes the request.
 *
 * @returns {Promise<{ url: string, requests: string[], close: () => Promise<void> }>}
 */
async function startProxyRecorder() {
	const requests = [];
	const sockets = new Set();
	const server = net.createServer((socket) => {
		sockets.add(socket);
		socket.once('close', () => sockets.delete(socket));
		socket.once('data', (data) => {
			requests.push(data.toString().split('\r\n')[0]);
			socket.end('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
		});
		socket.on('error', () => {});
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const url = `http://127.0.0.1:${server.address().port}`;

	const savedEnv = {};
	for (const name of PROXY_ENV_VARS) {
		savedEnv[name] = process.env[name];
		delete process.env[name];
	}
	process.env.HTTPS_PROXY = url;
	nock.restore();

	return {
		url,
		requests,
		close: async () => {
			nock.activate();
			for (const name of PROXY_ENV_VARS) {
				if (savedEnv[name] === undefined) {
					delete process.env[name];
				} else {
					process.env[name] = savedEnv[name];
				}
			}
			for (const socket of sockets) {
				socket.destroy();
			}
			await new Promise((resolve) => server.close(() => resolve()));
		}
	};
}

module.exports = { startProxyRecorder };
