const packageInfo = require('../package.json');

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const semver = require('semver');
const request = require('request');

const buildDir = process.argv[2] || './build';
const version = packageInfo.version;
const baseUrl = process.argv[3];
const installerManifestUrl = `${baseUrl}/installer/manifest.json`;

function generateSHA(filePath) {
	const fileBuffer = fs.readFileSync(filePath);
	const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
	return { sha256: sha256Hash };
}

function constructUrl(platform, arch) {
	return `${baseUrl}/${version}/${platform}/${arch}/${platform === 'win32' ? 'particle.exe.gz' : 'particle.gz'}`;
}

function parseFilename(filename) {
	// Simplified parsing logic, adjust as needed
	console.log('parsing', filename);
	const platformMap = { macos: 'darwin', linux: 'linux', win: 'win32' };
	const archMap = { armv7: 'arm' };

	const parts = filename.split('-');
	let arch;
	if (parts.length > 3) {
		arch = parts[3].split('.')[0];
	}
	return {
		platform: platformMap[parts[2]] || parts[2],
		arch: archMap[arch] || arch // Removing file extension if present
	};
}

async function generateManifest() {
	const files = fs.readdirSync(buildDir);
	const manifest = {
		released_at: new Date().toISOString(),
		version: version,
		channel: 'main',
		builds: {}
	};

	files.forEach(file => {
		if (!file.startsWith('particle-cli-') || file.includes('unsigned')) {
			// skip non-cli files and unsigned files
			return;
		}
		const filePath = path.join(buildDir, file);
		const fileStats = fs.statSync(filePath);
		if (fileStats.isFile()) {
			const { sha256 } = generateSHA(filePath);
			const { platform, arch } = parseFilename(file);
			if (!manifest.builds[platform]) {
				manifest.builds[platform] = {};
			}
			manifest.builds[platform][arch] = {
				url: constructUrl(platform, arch),
				sha256
			};
		}
	});

	const manifestVersionPath = `./manifest-${version}.json`;
	fs.writeFileSync(path.join(buildDir, manifestVersionPath), JSON.stringify(manifest, null, 2));
	console.log(`Manifest generated at ${manifestVersionPath}`);

	// If it's not a pre-release, also create a general manifest.json
	if (!semver.prerelease(version)) {
		console.log('This is a stable release, creating general manifest.json');
		fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
		console.log('General manifest.json also created.');
	}
	await generateInstallerManifest(version, buildDir);
	await restructureFiles(version, buildDir, buildDir);
}
async function generateInstallerManifest(version, buildDir) {
	const downloadedManifest = await downloadCurrentManifestInstaller(installerManifestUrl);
	let manifest = {
		installers: []
	};
	if (downloadedManifest) {
		manifest = downloadedManifest;
	}
	const installerData = {
		released_at: new Date().toISOString(),
		version: version,
		platforms: {
			win32: {
				url: `${baseUrl}/installer/${version}/win32/ParticleCLISetup.exe`,
				manifest: `${baseUrl}/manifest-${version}.json`
			}
		}
	};
	manifest.installers.push(installerData);
	const installerManifestPath = path.join(buildDir, 'installer-manifest.json');
	fs.writeFileSync(installerManifestPath, JSON.stringify(manifest, null, 2));
}
async function downloadCurrentManifestInstaller(url) {
	return new Promise((resolve, reject) => {
		request({ url: url, json: true }, (error, response, body) => {
			if (error) {
				reject(new Error(`Error making request: ${error.message}`));
			} else if (response.statusCode !== 200) {
				resolve(null);
			} else {
				resolve(body);
			}
		});
	});
}

async function moveFile(source, target) {
	try {
		await fs.move(source, target, { overwrite: true });
		console.log(`Moved ${source} to ${target}`);
	} catch (error) {
		console.error(`Error moving file ${source}:`, error);
	}
}

async function restructureFiles(version, sourceDir, targetBaseDir) {
	const fileMappings = [
		{ test: /^ParticleCLISetup\.exe$/, newPath: [
			path.join(targetBaseDir, 'release', 'installer', version, 'win32', 'ParticleCLISetup.exe'),
			path.join(targetBaseDir, 'release', 'installer', 'win32', 'ParticleCLISetup.exe')
		] },
	];
	const excludedFiles = [
		/^manifest(-\d+\.\d+\.\d+)?\.json$/,
		/^particle-cli-.*-unsigned\.exe(\.gz)?$/,
		/^ParticleCLISetup(-unsigned)?\.exe(\.gz)?$/
	];

	try {
		const files = await fs.readdir(sourceDir);
		for (const file of files) {
			const mapping = fileMappings.find(m => file.match(m.test));
			if (mapping) {
				const sourcePath = path.join(sourceDir, file);
				for (const newPath of mapping.newPath) {
					await fs.ensureDir(path.dirname(newPath));
					await fs.copy(sourcePath, newPath, { overwrite: true });
					console.log(`Adding ${sourcePath} to ${newPath}`);
				}
			} else {
				// means is not an installer file
				if (excludedFiles.some(regex => file.match(regex)) ) {
					console.log('Skipping excluded file:', file);
					continue;
				}
				const { platform, arch } = parseFilename(file);
				if (!platform || !arch) {
					console.error(`Could not determine platform and arch for ${file}`);
					continue;
				}
				const targetDir = path.join(targetBaseDir, 'release', version, platform, arch);
				await fs.ensureDir(targetDir);
				const newFileName = file.includes('exe') ? 'particle.exe.gz' : 'particle.gz';
				await moveFile(path.join(sourceDir, file), path.join(targetDir, newFileName));
			}
		}

		await moveManifestFiles(sourceDir, path.join(targetBaseDir, 'release'), version);

		console.log('Restructuring completed.');
	} catch (error) {
		console.error('Failed to restructure files:', error);
	}
}

async function moveManifestFiles(sourceDir, targetBaseDir, version) {
	const manifestFiles = ['manifest.json', `manifest-${version}.json`];
	for (const fileName of manifestFiles) {
		const sourcePath = path.join(sourceDir, fileName);
		const targetPath = path.join(targetBaseDir, fileName);
		await moveFile(sourcePath, targetPath);
	}
}


(async () => {
	await generateManifest();
})();
