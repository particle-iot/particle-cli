const fs = require('fs-extra');
const execa = require('execa');
const osslsigncode = process.argv[2] || 'osslsigncode';
(async () => {
	// generate ParticleCLISetup installer
	const args = [
		'./installer/windows/ParticleCLISetup.nsi'
	];
	await execa('makensis', args, { stdio: 'inherit' });
	await fs.move('./installer/windows/ParticleCLISetup.exe', './build/ParticleCLISetup.exe', { overwrite: true });
	console.log('Generated ParticleCLISetup installer');
	console.log('Signing Windows Installers');
	await execa('node', ['./scripts/win-sign.js', 'ParticleCLISetup', osslsigncode], { stdio: 'inherit' });
	console.log('done');
})();
