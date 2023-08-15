const path = require('path');
const fs = require('fs');


// Walk the assets/knownApps directory to find all known apps
function knownAppNames() {
	const knownAppsPath = path.join(__dirname, '../../assets/knownApps');
	const names = new Set();
	fs.readdirSync(knownAppsPath).forEach((platform) => {
		const platformPath = path.join(knownAppsPath, platform);
		const stat = fs.statSync(platformPath);
		if (!stat.isDirectory()) {
			return;
		}

		fs.readdirSync(platformPath).forEach((appName) => {
			const appPath = path.join(platformPath, appName);
			const stat = fs.statSync(appPath);
			if (!stat.isDirectory()) {
				return;
			}
			names.add(appName);
		});
	});

	return Array.from(names);
}

// Walk the assets/knownApps/${name} directory to find known app binaries for this platform
function knownAppsForPlatform(name) {
	const platformKnownAppsPath = path.join(__dirname, '../../assets/knownApps', name);
	try {
		return fs.readdirSync(platformKnownAppsPath).reduce((knownApps, appName) => {
			try {
				const appPath = path.join(platformKnownAppsPath, appName);
				const binaries = fs.readdirSync(appPath);
				const appBinary = binaries.filter(filename => filename.match(/\.bin$/))[0];
				if (appBinary) {
					knownApps[appName] = path.join(appPath, appBinary);
				}
			} catch (e) {
				// ignore errors
			}

			return knownApps;
		}, {});
	} catch (e) {
		// no known apps for this platform
		return {};
	}
}

module.exports = {
	knownAppNames,
	knownAppsForPlatform
};
