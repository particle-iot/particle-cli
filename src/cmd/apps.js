const CLICommandBase = require('./base');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('yaml');
const fetch = require('node-fetch');
const execa = require('execa');
const { v4: uuidv4 } = require('uuid');
const settings = require('../../settings');

const DOCKER_CONFIG_URL = 'https://tachyon-ci.particle.io/alpha-assets/2ea71ce0afce170affb38d162a1e3460.json';

module.exports = class AppsCommands extends CLICommandBase {
	async push() {
		const appName = await this._getAppName();
		const uuid = uuidv4();
		const dockerConfigDir = await this._getDockerConfig();

		await this._configureDocker(dockerConfigDir);

		// read ${appName}/docker-compose.yaml, parse it and look in the services section for containers with a build key
		// For each container with a build key, build the container and tag it with a uuid, and push it to the registry
		// Then remove the build key from the docker-compose.yaml and replace it by the image key with the serviceTag
		const dockerCompose = await this._getDockerCompose(appName);

		const services = dockerCompose.get('services');
		if (services) {
			for (const { key: { value: service }, value: serviceConfig } of services.items) {
				const buildDir = serviceConfig.get('build');
				if (buildDir) {
					const serviceTag = `particleapp/${service}:${uuid}`;
					await this._builderContainer(dockerConfigDir, path.join(appName, buildDir), serviceTag);
					await this._pushContainer(dockerConfigDir, serviceTag);
					this._updateDockerCompose(serviceConfig, serviceTag);
				}
			}
		}

		// HERE print out the updated docker-compose.yaml

		return `Successfully pushed ${appName}:${uuid}`;
	}

	async _getAppName() {
		const blueprintPath = path.resolve('blueprint.yaml');
		if (!await fs.pathExists(blueprintPath)) {
			throw new Error('blueprint.yaml not found. Run this command inside a directory with a project blueprint.');
		}

		let doc;
		try {
			const blueprintContent = await fs.readFile(blueprintPath, 'utf8');
			doc = yaml.parseDocument(blueprintContent);
		} catch (error) {
			throw new Error(`Failed to parse blueprint.yaml: ${error.message}`);
		}
		const appName = doc.get('containers');
		if (!appName || typeof appName !== 'string') {
			throw new Error('Invalid blueprint configuration: containers directory is missing.');
		}
		return appName;
	}

	async _getDockerConfig() {
		const particleDir = settings.ensureFolder();
		const dockerConfigDir = path.join(particleDir, 'docker');
		await fs.ensureDir(dockerConfigDir);
		try {
			const response = await fetch(DOCKER_CONFIG_URL);
			const data = await response.buffer();
			await fs.writeFile(path.join(dockerConfigDir, 'config.json'), data);
		} catch (error) {
			throw new Error(`Failed to fetch docker config: ${error.message}`);
		}
		return dockerConfigDir;
	}

	async _getDockerCompose(appName) {
		const dockerComposePath = path.join(appName, 'docker-compose.yaml');
		try {
			const composeData = await fs.readFile(dockerComposePath, 'utf8');
			return yaml.parseDocument(composeData);
		} catch (error) {
			throw new Error(`Failed to read ${dockerComposePath}: ${error.message}`);
		}
	}

	async _configureDocker(dockerConfigDir) {
		try {
			// TODO: check if particle context already exists

			// const dockerContext = (await execa('docker', ['context', 'show'])).stdout;
			//
			// // Copy the current context to a particle context
			// const exportContext = execa('docker', ['context', 'export', dockerContext, '-']);
			// const importContext = execa('docker', ['--config', dockerConfigDir, 'context', 'import', 'particle', '-']);
			// exportContext.stdout.pipe(importContext.stdin);
			// await importContext;

			await execa('docker', ['--config', dockerConfigDir, 'context', 'use', 'particle']);
		} catch (error) {
			throw new Error(`Failed to configure docker. Make sure Docker is installed and running on your machine: ${error.message}`);
		}
	}

	async _builderContainer(dockerConfigDir, buildDir, serviceTag) {
		try {
			await execa('docker', ['--config', dockerConfigDir, 'build', buildDir, '--platform', 'linux/arm64', '--tag', serviceTag], { stdio: 'inherit' });
		} catch (error) {
			throw new Error(`Failed to build container ${serviceTag}. See the Docker output for details: ${error.message}`);
		}
	}

	async _pushContainer(dockerConfigDir, serviceTag) {
		try {
			await execa('docker', ['--config', dockerConfigDir, 'push', serviceTag], { stdio: 'inherit' });
		} catch (error) {
			throw new Error(`Failed to push the container ${serviceTag}. See the Docker output for details: ${error.message}`);
		}
	}

	_updateDockerCompose(serviceConfig, serviceTag) {
		serviceConfig.delete('build');
		serviceConfig.set('image', serviceTag);
	}

	list() {
		throw new Error('Not implemented');
	}

	remove() {
		throw new Error('Not implemented');
	}
};
