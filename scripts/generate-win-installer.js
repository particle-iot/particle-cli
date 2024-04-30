const fs = require('fs-extra');
const execa = require('execa');

(async () => {
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
