

const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');
const readline = require('readline');

function getHostnameFromUrl(urlString) {
	try {
		if (!urlString.includes('://')) {
			// If no scheme, treat as host/path
			return urlString;
		}
		const u = new URL(urlString);
		return u.hostname;
	} catch {
		throw new Error(`Invalid URL: ${urlString}`);
	}
}
function runGetCommand() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false,
	});

	let inputData = '';

	rl.on('line', (line) => {
		inputData += line;
	});

	rl.on('close', () => {
		const urlString = inputData.trim();
		const host = getHostnameFromUrl(urlString);

		if (!host) {
			console.error('Invalid URL');
			process.exit(1);
		}

		if (!host.endsWith('particle.io')) {
			console.error(`unsupported host: ${host}`);
			process.exit(1);
		}

		const targetDomain = host.split('.').slice(1).join('.');
		const homeDir = os.homedir();
		const particleConfigDir = path.join(homeDir, '.particle');

		let files;
		try {
			files = fs.readdirSync(particleConfigDir);
		} catch (err) {
			console.error(err.message);
			process.exit(1);
		}

		for (const file of files) {
			if (file.endsWith('.config.json')) {
				const filePath = path.join(particleConfigDir, file);
				let config;
				try {
					const raw = fs.readFileSync(filePath, 'utf8');
					config = JSON.parse(raw);
				} catch (err) {
					console.error(err.message);
					process.exit(1);
				}

				if (!config.apiUrl) {
					continue;
				}

				const apiHost = getHostnameFromUrl(config.apiUrl);
				if (!apiHost) {
					continue;
				}

				const apiDomain = apiHost.split('.').slice(1).join('.');
				if (apiDomain === targetDomain) {
					const dockerCreds = {
						ServerURL: urlString,
						Username: config.username,
						Secret: config.access_token,
					};

					process.stdout.write(JSON.stringify(dockerCreds));
					process.exit(0);
				}
			}
		}
	});
}

function runListCommand() {
	const homeDir = os.homedir();
	const particleConfigDir = path.join(homeDir, '.particle');

	let files;
	try {
		files = fs.readdirSync(particleConfigDir);
	} catch (err) {
		console.error(err.message);
		process.exit(1);
	}

	const storedCredentials = {};

	for (const file of files) {
		if (file.endsWith('.config.json')) {
			const filePath = path.join(particleConfigDir, file);
			let config;
			try {
				const raw = fs.readFileSync(filePath, 'utf8');
				config = JSON.parse(raw);
			} catch (err) {
				console.error(err.message);
				process.exit(1);
			}

			if (!config.apiUrl) {
				continue;
			}

			const apiHost = getHostnameFromUrl(config.apiUrl);
			if (!apiHost) {
				continue;
			}

			const apiDomain = apiHost.split('.').slice(1).join('.');

			if (apiDomain.endsWith('particle.io')) {
				storedCredentials[`registry.${apiDomain}`] = config.username;
			}
		}
	}
	process.stdout.write(JSON.stringify(storedCredentials));
}

// If this file is run directly, execute the command
if (require.main === module) {
	runCommand();
}

function runCommand() {
	// if executed with an arg of 'get' run the get command
	if (process.argv[2] === 'get') {
		runGetCommand();
	} else if (process.argv[2] === 'list') {
		runListCommand();
	} else if (process.argv[2] === 'store' || process.argv[2] === 'erase') {
		// no-op for now, just exit 0
		process.exit(0);
	}
}

module.exports = { runCommand, runGetCommand };
