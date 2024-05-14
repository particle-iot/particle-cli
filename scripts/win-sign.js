#!/usr/bin/env node
require('dotenv').config();
const path = require('path');
const fs = require('fs-extra');
const execa = require('execa');
const pkgJSON = require('../package.json');
const log = require('../src/lib/log').info;
const logErrorAndExit = require('../src/lib/log').error;
const BUILD_DIR = path.join(__dirname, '..', 'build');
const particleBuildName = process.argv[2] || 'particle-cli-win-x64';
const osslsigncode = process.argv[3] || 'osslsigncode';

(async () => {
	try {

		log('Signing Windows Installers');

		const signingParams = getSigningParams(pkgJSON, '/tmp');
		const { p12, name, version, certificate } = signingParams;

		log(`Saving windows signing certificate for ${name}@${version} to ${p12}`);

		await fs.writeFile(p12, Buffer.from(certificate, 'base64'));
		const bin = path.join(BUILD_DIR, `${particleBuildName}.exe`);
		const unsigned = path.join(BUILD_DIR, `${particleBuildName}-unsigned.exe`);

		log(`Signing .exe for ${name}@${version} on x64`);

		await fs.move(bin, unsigned); // Move the original exe to a new file to sign it
		await winSign({ unsigned, signed: bin }, signingParams);

		log('removing temporal files');
		await fs.remove(p12);

	} catch (error) {
		return logErrorAndExit(error);
	}
	log('All Done!');
})();

// UTILS //////////////////////////////////////////////////////////////////////
function winSign(exe, params) {
	const { p12, bin, homepage, password } = params;
	const args = [
		'sign',
		'-pkcs12',
		p12,
		'-pass',
		password,
		'-n',
		bin,
		'-i',
		homepage,
		'-h',
		'sha512',
		'-ts',
		'timestamp.digicert.com',
		'-in',
		exe.unsigned,
		'-out',
		exe.signed
	];

	return execa(`${osslsigncode}`, args);
}

function getSigningParams(pkgJSON, tmpDir) {
	const { name, version } = pkgJSON;
	const homepage = pkgJSON.homepage; // Directly using the package's homepage

	if (!version || !homepage) {
		throw new Error(`${name} package has malformed package.json - 'version', and 'homepage' fields are required`);
	}
	const envVars = getEnvVars();

	if (!envVars.certificate.value || !envVars.password.value) {
		throw new Error(`'${envVars.certificate.var}' and '${envVars.password.var}' environment variables must be set`);
	}

	const p12 = path.join(tmpDir, 'win-cert.p12');
	const certificate = envVars.certificate.value;
	const password = envVars.password.value;

	return {
		p12,
		name,
		version,
		homepage,
		certificate,
		password
	};
}

function getEnvVars() {
	const certificate = 'PARTICLE_WINDOWS_SIGNING_CERT';
	const password = 'PARTICLE_WINDOWS_SIGNING_PASS';

	return {
		certificate: {
			var: certificate,
			value: process.env[certificate]
		},
		password: {
			var: password,
			value: process.env[password]
		}
	};
}
