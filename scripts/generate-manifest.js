const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const semver = require('semver');

const buildDir = process.argv[2] || './build';
const version = cleanVersion(process.argv[3]); // Version tag, e.g., '1.2.0' or '1.2.0-alpha.1'
const baseUrl = process.argv[4];

function generateSHA(filePath) {
	const fileBuffer = fs.readFileSync(filePath);
	const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
	return { sha256: sha256Hash };
}

function constructUrl(platform, arch) {
	return `${baseUrl}/${version}/${platform}/${arch}/${platform === 'win' ? 'particle.exe.gz' : 'particle.gz'}`;
}

function parseFilename(filename) {
	// Simplified parsing logic, adjust as needed
	const platformMap = { macos: 'darwin', linux: 'linux', win: 'win' };
	const archMap = { x64: 'amd64', arm64: 'arm64' };
	const parts = filename.split('-');
	return {
		platform: platformMap[parts[2]],
		arch: archMap[parts[3].split('.')[0]] // Removing file extension if present
	};
}

function cleanVersion(version) {
	const cleanedVersion = version.replace(/^v|^test-/, '');
	if (!semver.valid(cleanedVersion)) {
		throw new Error(`Invalid version: ${version}`);
	}
	return cleanedVersion;
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
	await restructureFiles(version, buildDir, buildDir);
}

async function moveFile(source, target) {
	try {
		await fs.move(source, target, { overwrite: true });
		console.log(`Moved ${source} to ${target}`);
	} catch (error) {
		console.error(`Error moving file ${source}:`, error);
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

async function restructureFiles(version, sourceDir, targetBaseDir) {
	const fileMappings = [
		{ test: /^particle-cli-linux-x64.gz$/, newPath: [path.join(targetBaseDir,'release', version, 'linux', 'amd64', 'particle.gz')] },
		{ test: /^particle-cli-macos-x64.gz$/, newPath: [path.join(targetBaseDir,'release', version, 'darwin', 'amd64', 'particle.gz')] },
		{ test: /^particle-cli-macos-arm64.gz$/, newPath: [path.join(targetBaseDir,'release', version, 'darwin', 'arm64', 'particle.gz')] },
		{ test: /^particle-cli-win-x64\.exe.gz$/, newPath: [path.join(targetBaseDir,'release', version, 'win', 'amd64', 'particle.exe.gz')] },
		{ test: /^ParticleCLISetup\.exe$/, newPath: [
			path.join(targetBaseDir, 'release', 'installer', version, 'windows', 'ParticleCLISetup.exe'),
			path.join(targetBaseDir, 'release', 'installer', 'windows', 'ParticleCLISetup.exe')
		] },
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
			}
		}

		await moveManifestFiles(sourceDir, path.join(targetBaseDir, 'release'), version);

		console.log('Restructuring completed.');
	} catch (error) {
		console.error('Failed to restructure files:', error);
	}
}

(async () => {
	await generateManifest();
})();
