const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const execa = require('execa');
const openSSLDownloadUrl = 'https://binaries.particle.io/cli/installer/windows/Win32OpenSSL_Light-1_1_0d.exe';
const installerPath = path.join(__dirname, '..', 'installer', 'windows', 'bin', 'Win32OpenSSL_Light-1_1_0d.exe');

(async () => {
	await fs.ensureDir(path.dirname(installerPath));
	await downloadOpenSSL(openSSLDownloadUrl, installerPath);
	console.log('Downloaded OpenSSL');
	// generate ParticleCLISetup installer
	const args = [
		'./installer/windows/ParticleCLISetup.nsi'
	];
	await execa('makensis', args, { stdio: 'inherit' });
	await fs.move('./installer/windows/ParticleCLISetup.exe', './build/ParticleCLISetup.exe', { overwrite: true });
	console.log('Generated ParticleCLISetup installer');
	console.log('Signing Windows Installers');
	await execa('node', ['./scripts/win-sign.js', 'ParticleCLISetup'], { stdio: 'inherit' });
	console.log('done');
})();


function downloadOpenSSL(url, dest) {
	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(dest);
		https.get(url, (response) => {
			if (response.statusCode !== 200) {
				reject(new Error(`Failed to download file: Status Code ${response.statusCode}`));
				return;
			}
			response.pipe(file);
			file.on('finish', () => {
				file.close();
				resolve('Download Completed');
			});
		}).on('error', (err) => {
			// Handle errors
			fs.unlink(dest, () => {});
			reject(err);
		});
	});
}
