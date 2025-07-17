const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const yaml = require('yaml');
const fetch = require('node-fetch');
const execa = require('execa');
const { v4: uuidv4 } = require('uuid');

const CLICommandBase = require('./base');
const settings = require('../../settings');
const ParticleApi = require('./api');
const { UnauthorizedError } = require('./api');
const Table = require('cli-table');
const { platformForId } = require('../lib/platform');

const _ = require('lodash');

const DOCKER_CONFIG_URL = 'https://linux-dist.particle.io/alpha-assets/2ea71ce0afce170affb38d162a1e3460.json';
const PARTICLE_ENV_FILE = '.particle_env.yaml';

module.exports = class AppCommands extends CLICommandBase {
	constructor() {
		super();
		const auth = settings.access_token;
		this.api = new ParticleApi(settings.apiUrl, { accessToken: auth });
	}

	async run({ blueprintDir = '.' }) {
		const instance = Math.random().toString(36).substring(2, 8);
		const appName = await this._getAppName(blueprintDir);
		const appInstance = `${appName}_${instance}`;
		this.ui.write(`Running application ${appInstance}...${os.EOL}`);
		const composeDir = path.join(blueprintDir, appName);
		if (!await fs.pathExists(composeDir)) {
			throw new Error(`Application directory ${composeDir} not found.`);
		}

		const dockerConfigDir = await this._getDockerConfig();

		await this._configureDockerContext(dockerConfigDir);

		let dockerComposePath = path.join(composeDir, 'docker-compose.yaml');
		if (!await fs.pathExists(dockerComposePath)) {
			dockerComposePath = path.join(composeDir, 'docker-compose.yml');
			if (!await fs.pathExists(dockerComposePath)) {
				throw new Error(`docker-compose.yaml not found in ${composeDir}.`);
			}
		}

		// provide access to the X server to Docker
		try {
			await execa('xhost', ['+local:root']);
			await execa('xhost', ['+local:particle']);
			await execa('xhost', ['+SI:localuser:root']);
		} catch {
			// ignore errors on non-Linux systems
		}

		try {
			// Executing docker-compose up
			await execa('docker', ['--config', dockerConfigDir, 'compose', '-p', appInstance, 'up', '--build'], { stdio: 'inherit', cwd: composeDir });
		} catch (error) {
			throw new Error(`Failed to run Docker Compose: ${error.message}`);
		}
	}

	async push({ deviceId, instance, blueprintDir = '.' }) {
		try {
			const doc = await this._loadFromEnv(blueprintDir);
			deviceId ||= doc.get('deviceId');
			const device = await this._getDevice(deviceId);
			deviceId = device.id;
			instance ||= doc.get('instance') || Math.random().toString(36).substring(2, 8);

			await this.validateApplicationsHaveBeenMigrated(device);

			const appName = await this._getAppName(blueprintDir);
			const appInstance = `${appName}_${instance}`;
			doc.set('deviceId', deviceId);
			doc.set('instance', instance);
			await this._saveToEnv(doc, blueprintDir);

			this.ui.write(`Pushing application ${appInstance} to device ${deviceId}...${os.EOL}`);

			this.ui.write('Building application...');
			const composeDir = path.join(blueprintDir, appName);
			const uuid = uuidv4();
			const dockerConfigDir = await this._getDockerConfig();

			await this._configureDockerContext(dockerConfigDir);

			// read ${appName}/docker-compose.yaml, parse it and look in the services section for containers with a build key
			// For each container with a build key, build the container and tag it with a uuid, and push it to the registry
			// Then remove the build key from the docker-compose.yaml and replace it by the image key with the serviceTag
			const dockerCompose = await this._getDockerCompose(composeDir);

			const services = dockerCompose.get('services');
			if (services) {
				for (const { key: { value: service }, value: serviceConfig } of services.items) {
					const buildDir = serviceConfig.get('build');
					if (buildDir) {
						const serviceTag = `particleapp/${service}:${uuid}`;
						await this._buildContainer(dockerConfigDir, path.join(composeDir, buildDir), serviceTag);
						await this._pushContainer(dockerConfigDir, serviceTag);
						this._updateDockerCompose(serviceConfig, serviceTag);
					}
				}
			}

			this.ui.write(`${os.EOL}Successfully built ${appInstance}${os.EOL}`);

			await this._pushApp(device, appInstance, dockerCompose.toString());

			this.ui.write(`Successfully pushed ${appInstance} to device ${deviceId}${os.EOL}`);
		} catch (error) {
			if (error instanceof UnauthorizedError) {
				throw new Error('You must be logged in to push an application to a device.');
			}
			throw error;
		}
	}

	async _getAppName(blueprintDir) {
		const blueprintPath = path.resolve(blueprintDir, 'blueprint.yaml');
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

	async _getDockerCompose(composeDir) {
		let dockerComposePath = path.join(composeDir, 'docker-compose.yaml');
		try {
			if (!await fs.exists(dockerComposePath)) {
				dockerComposePath = path.join(composeDir, 'docker-compose.yml');
			}
			const composeData = await fs.readFile(dockerComposePath, 'utf8');
			return yaml.parseDocument(composeData);
		} catch (error) {
			throw new Error(`Failed to read ${dockerComposePath}: ${error.message}`);
		}
	}

	async _checkDockerVersion() {
		const { stdout: dockerVersion } = await execa('docker', ['--version']);
		const versionMatch = dockerVersion.match(/Docker version (\d+\.\d+\.\d+)/);
		if (!versionMatch) {
			throw new Error('Docker version 27 or later is required.');
		} else if (parseInt(versionMatch[1].split('.')[0]) < 27) {
			throw new Error(`Docker version 27 or later is required. Version ${versionMatch[1]} detected.`);
		}
	}

	async _copySystemDockerContext(dockerConfigDir) {
		// Get the name of the current system docker context
		const dockerContext = (await execa('docker', ['context', 'show'])).stdout;
		// Export the system context and import it as 'particle' context in the docker config directory
		const exportContext = execa('docker', ['context', 'export', dockerContext, '-']);
		const importContext = execa('docker', ['--config', dockerConfigDir, 'context', 'import', 'particle', '-']);
		exportContext.stdout.pipe(importContext.stdin);
		await importContext;
	}

	async _configureDockerContext(dockerConfigDir) {
		try {
			// Check if the 'particle' context exists in the docker config directory
			await this._checkDockerVersion();
			const particleDockerContextsList = (await execa('docker', ['--config', dockerConfigDir, 'context', 'ls', '--format', '{{.Name}}'])).stdout;
			if (!particleDockerContextsList.includes('particle')) {
				await this._copySystemDockerContext(dockerConfigDir);
			} else {
				// We have a context, does it need to be updated?
				const systemDockerContextInspect = (await execa('docker', ['context', 'inspect']));
				const particleDockerContextInspect = (await execa('docker', ['--config', dockerConfigDir, 'context', 'inspect', 'particle']));
				const systemDockerContext = JSON.parse(systemDockerContextInspect.stdout);
				const particleDockerContext = JSON.parse(particleDockerContextInspect.stdout);
				const extractEndpoints = (contexts) => contexts.map(ctx => ctx.Endpoints || {});
				if (!_.isEqual(extractEndpoints(systemDockerContext), extractEndpoints(particleDockerContext))) {
					// Update the context
					await execa('docker', ['--config', dockerConfigDir, 'context', 'rm', '-f', 'particle']);
					await this._copySystemDockerContext(dockerConfigDir);
				}
			}

			const currentContext = (await execa('docker', ['--config', dockerConfigDir, 'context', 'show'])).stdout;
			if (currentContext !== 'particle') {
				await execa('docker', ['--config', dockerConfigDir, 'context', 'use', 'particle']);
			}

		} catch (error) {
			throw new Error(`Failed to configure docker. Make sure Docker is installed and running on your machine: ${error.message}`);
		}
	}

	async _buildContainer(dockerConfigDir, buildDir, serviceTag) {
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

	async _pushApp(device, name, composeFile) {
		try {
			// Use PATCH method to update the device document
			await this.api.patchDocument({
				productId: device.product_id,
				deviceId: device.id,
				docName: 'system',
				patchOps: {
					action: 'upsert',
					path: ['features', 'applications', 'desiredProperties', 'apps'],
					key: 'name',
					value: {
						name,
						composeFile
					}
				}
			});

		} catch (error) {
			if (error.statusCode === 404) {
				throw new Error(`Connect ${device.id} to the cloud before pushing an application. Run particle login and try again.`);
			}
			console.error('Error pushing application to the device:', error);
			throw error;
		}
	}

	async list({ deviceId, blueprintDir = '.' }) {
		const doc = await this._loadFromEnv(blueprintDir);
		deviceId ||= doc.get('deviceId');
		const device = await this._getDevice(deviceId);
		deviceId = device.id;

		doc.set('deviceId', deviceId);
		await this._saveToEnv(doc, blueprintDir);

		try {
			const deviceDoc = await this.validateApplicationsHaveBeenMigrated(device);

			const desiredApps = _.get(deviceDoc, 'features.applications.desiredProperties.apps');
			if (!desiredApps || desiredApps.length === 0) {
				this.ui.write(`No applications desired for device ${deviceId}.${os.EOL}`);
			} else { // exists and is an array with length
				this.ui.write(`Applications desired for device ${deviceId}:`);

				for (const app of desiredApps) {
					this.ui.write(app.name);
				}
				this.ui.write(os.EOL);
			}

			// We can assume at this point that apps is an array since we migrate both at the same time on device and we return above
			const apps = deviceDoc.features?.applications?.properties?.apps;
			if (!apps || apps.length === 0) {
				return this.ui.write(`No applications running on device ${deviceId}.${os.EOL}`);
			}

			this.ui.write(`Applications running on device ${deviceId}:${os.EOL}`);

			for (const app of apps) {
				this.ui.write(`App name: ${app.name}`);

				// Create a table with headers
				const cols = (process.stdout.columns || 80) - 35;
				const table = new Table({
					head: ['Container', 'Details'],
					colWidths: [30, cols],
					style: { head: ['white'] }
				});
				if (app.containers) {
					for (const { name, ...details } of app.containers) {
						table.push([name, JSON.stringify(details, null, 2)]);
					}
				} else {
					table.push(['No containers for app', '']);
				}
				this.ui.write(table.toString() + os.EOL);
			}
		} catch (error) {
			if (error instanceof UnauthorizedError) {
				throw new Error('You must be logged in to list applications. Run particle login and try again.');
			}
			if (error.statusCode === 404) {
				throw new Error(`${device.id} has no cloud application.`);
			}
			console.error('Error getting application from the device:', error);
			throw error;
		}
	}

	async remove({ deviceId, appInstance, blueprintDir = '.' }) {
		if (!appInstance) {
			throw new Error('Application instance is required.');
		}

		const doc = await this._loadFromEnv(blueprintDir);
		deviceId ||= doc.get('deviceId');
		const device = await this._getDevice(deviceId);
		deviceId = device.id;
		doc.set('deviceId', deviceId);
		await this._saveToEnv(doc, blueprintDir);

		try {
			const deviceDoc = await this.validateApplicationsHaveBeenMigrated(device);

			const apps = _.get(deviceDoc, 'features.applications.desiredProperties.apps');
			const foundApp = apps?.find((app) => app.name === appInstance);
			if (foundApp) {
				await this.api.patchDocument({
					productId: device.product_id,
					deviceId: device.id,
					docName: 'system',
					patchOps: {
						action: 'remove',
						path: ['features', 'applications', 'desiredProperties', 'apps'],
						predicate: { name: appInstance }
					}
				});
				this.ui.write(`Successfully removed ${appInstance} from device ${deviceId}.${os.EOL}`);
			} else {
				this.ui.write(`Application ${appInstance} not found on device ${deviceId}.${os.EOL}`);
			}
		} catch (error) {
			if (error instanceof UnauthorizedError) {
				throw new Error('You must be logged in to remove an application. Run particle login and try again.');
			}
			if (error.statusCode === 404) {
				throw new Error(`${device.id} has no cloud application.`);
			}

			console.error(`Error removing application ${appInstance} from device ${deviceId}:`, error);
			throw error;
		}
	}

	async _loadFromEnv(blueprintDir) {
		try {
			const envPath = path.join(blueprintDir, PARTICLE_ENV_FILE);
			const envContent = await fs.readFile(envPath, 'utf8');
			return yaml.parseDocument(envContent);
		} catch {
			return new yaml.Document();
		}

	}

	async _getDevice(deviceId) {
		if (deviceId) {
			return this._getDeviceAttributes(deviceId);
		} else {
			this.ui.write('Select a device for this operation from one of your existing products.\nThis device will be remembered for future operations.');
			return this._selectDevice();
		}
	}

	async _getDeviceAttributes(deviceId) {
		try {
			return await this.api.getDeviceAttributes(deviceId);
		} catch (error) {
			throw new Error(`You do not have access to the ${deviceId}: ${error.message}`);
		}
	}

	async _loadDeviceFromEnv(blueprintDir) {
		try {
			const envPath = path.join(blueprintDir, PARTICLE_ENV_FILE);
			const envContent = await fs.readFile(envPath, 'utf8');
			let doc = yaml.parseDocument(envContent);
			return await this._getDeviceAttributes(doc.get('device_id'));
		} catch {
			return null;
		}
	}

	async _saveToEnv(doc, blueprintDir) {
		// load existing env file and parse as yaml doc
		const envPath = path.join(blueprintDir, PARTICLE_ENV_FILE);
		try {
			await fs.writeFile(envPath, doc.toString());
		} catch (error) {
			this.ui.write(`Warning: Failed to save ${envPath}: ${error.message}`);
		}
	}

	async _selectDevice() {
		const { orgSlug } = await this._getOrg();
		let productId = await this._getProduct(orgSlug);

		if (!productId) {
			throw new Error('You do not have any Linux/Tachyon products available. Create a new product in the Console and try again.');
		}
		let device = await this._getDeviceProduct(productId);
		if (!device) {
			throw new Error('You do not have any Linux/Tachyon devices in this product. Setup a device and try again.');
		}

		return device;
	}

	async _getOrg() {
		const orgsResp = await this.api.getOrgs();
		const orgs = orgsResp.organizations;

		const orgName = orgs.length
			? await this._promptForOrg([...orgs.map(org => org.name), 'Sandbox'])
			: 'Sandbox';

		const orgSlug = orgName !== 'Sandbox' ? orgs.find(org => org.name === orgName).slug : null;
		return { orgName, orgSlug };
	}

	async _promptForOrg(choices) {
		const question = [
			{
				type: 'list',
				name: 'org',
				message: 'Select an organization:',
				choices,
			},
		];
		const { org } = await this.ui.prompt(question);
		return org;
	}

	async _getProduct(orgSlug) {
		const productsResp = await this.api.getProducts(orgSlug);
		let products = productsResp?.products || [];

		products = products.filter((product) => platformForId(product.platform_id)?.features?.includes('linux'));

		if (!products.length) {
			return null; // No Linux/Tachyon products available
		}

		const selectedProductName = await this._promptForProduct(products.map(product => product.name));

		return products.find(p => p.name === selectedProductName)?.id;
	}

	async _promptForProduct(choices) {
		const question = [
			{
				type: 'list',
				name: 'product',
				message: 'Select a product:',
				choices,
			},
		];
		const { product } = await this.ui.prompt(question);
		return product;
	}


	async _getDeviceProduct(productId) {
		const devicesResp = await this.api.listDevices({ product: productId });
		const devices = devicesResp?.devices || [];

		if (!devices.length) {
			return null; // No devices in product
		}

		const choices = devices.map(device => {
			const displayName = device.name ? `${device.name} (${device.id})` : `${device.id}`;
			return { name: displayName, value: device };
		});

		return this._promptForDevice(choices);
	}

	async _promptForDevice(choices) {
		const question = [
			{
				type: 'list',
				name: 'device',
				message: 'Select a device:',
				choices,
			},
		];
		const { device } = await this.ui.prompt(question);
		return device;
	}

	/**
	 * Gets the device doc and validates that applications have been migrated to array format, throwing if not.
	 * If all is good, returns the device doc to reduce api calls
	 * @param {{ id: string, product_id: number }} device
	 * @returns object
	 */
	async validateApplicationsHaveBeenMigrated(device) {
		const { data: doc } = await this.api.getDocument({
			deviceId: device.id,
			productId: device.product_id,
			docName: 'system'
		});
		const apps = _.get(doc, 'features.applications.desiredProperties.apps');
		if (apps && !Array.isArray(apps)) {
			throw new Error('There has been an update to applications data format. Please update your particle-linux version to the latest.');
		}
		return doc;
	}
};
