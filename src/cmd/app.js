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

const DOCKER_CONFIG_URL = 'https://tachyon-ci.particle.io/alpha-assets/2ea71ce0afce170affb38d162a1e3460.json';
const PARTICLE_ENV_FILE = '.particle_env.yaml';

module.exports = class AppCommands extends CLICommandBase {
	constructor() {
		super();
		const auth = settings.access_token;
		this.api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
	}

	async run({ blueprintDir = '.' }){
		const appName = await this._getAppName(blueprintDir);
		this.ui.write(`Running application ${appName}...${os.EOL}`);
		const composeDir = path.join(blueprintDir, appName);
		if (!await fs.pathExists(composeDir)) {
			throw new Error(`Application directory ${composeDir} not found.`);
		}

		const dockerConfigDir = await this._getDockerConfig();

		await this._configureDocker(dockerConfigDir);

		let dockerComposePath = path.join(composeDir, 'docker-compose.yaml');
		if (!await fs.pathExists(dockerComposePath)) {
			dockerComposePath = path.join(composeDir, 'docker-compose.yml');
			if (!await fs.pathExists(dockerComposePath)) {
				throw new Error(`docker-compose.yaml not found in ${composeDir}.`);
			}
		}

		try {
			// Executing docker-compose up
			await execa('docker', ['--config', dockerConfigDir, 'compose', 'up'], { stdio: 'inherit', cwd: composeDir });
		} catch (error) {
			throw new Error(`Failed to run Docker Compose: ${error.message}`);
		}
	}

	async push({ deviceId, blueprintDir = '.' }) {
		try {
			const device = await this._getDevice(deviceId, blueprintDir);
			deviceId = device.id;

			const appName = await this._getAppName(blueprintDir);
			this.ui.write(`Pushing application ${appName} to device ${deviceId}...${os.EOL}`);

			this.ui.write('Building application...');
			const composeDir = path.join(blueprintDir, appName);
			const uuid = uuidv4();
			const dockerConfigDir = await this._getDockerConfig();

			await this._configureDocker(dockerConfigDir);

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
						await this._builderContainer(dockerConfigDir, path.join(composeDir, buildDir), serviceTag);
						await this._pushContainer(dockerConfigDir, serviceTag);
						this._updateDockerCompose(serviceConfig, serviceTag);
					}
				}
			}

			this.ui.write(`${os.EOL}Successfully built ${appName}${os.EOL}`);

			await this._pushApp(device, appName, dockerCompose);

			this.ui.write(`Successfully pushed ${appName} to device ${deviceId}${os.EOL}`);
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

			// await execa('docker', ['--config', dockerConfigDir, 'context', 'use', 'particle']);
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

	async _pushApp(device, appName, dockerCompose) {
		try {
			const { data: deviceDoc } = await this.api.getDocument({
				productId: device.product_id,
				deviceId: device.id,
				docName: 'system'
			});

			// Prepare the JSON Patch document
			let patchOps = [];

			// Ensure that the necessary paths exist in the document
			if (!deviceDoc.features) {
				patchOps.push({ op: 'add', path: '/features', value: {} });
			}
			if (!deviceDoc.features?.applications) {
				patchOps.push({ op: 'add', path: '/features/applications', value: {} });
			}
			if (!deviceDoc.features?.applications?.desiredProperties) {
				patchOps.push({ op: 'add', path: '/features/applications/desiredProperties', value: {} });
			}
			if (!deviceDoc.features?.applications?.desiredProperties?.apps) {
				patchOps.push({ op: 'add', path: '/features/applications/desiredProperties/apps', value: {} });
			}

			// Add or update the application in the device document
			patchOps.push({
				op: 'add',
				path: `/features/applications/desiredProperties/apps/${appName}`,
				value: { composeFile: dockerCompose.toString() }
			});

			// Use PATCH method to update the device document
			await this.api.patchDocument({
				productId: device.product_id,
				deviceId: device.id,
				docName: 'system',
				patchOps
			});

		} catch (error) {
			if (error.statusCode === 404) {
				throw new Error(`Connect ${device.id} to the cloud before pushing an application. Run particle login and try again.`);
			}
			console.error('Error pushing application to the device:', error);
			throw error;
		}
	}

	async list({ deviceId }) {
		const device = await this._getDevice(deviceId, '.');
		deviceId = device.id;

		try {
			const { data: deviceDoc } = await this.api.getDocument({
				productId: device.product_id,
				deviceId: device.id,
				docName: 'system'
			});

			const desiredApps = deviceDoc.features?.applications?.desiredProperties?.apps;
			if (desiredApps && Object.entries(desiredApps).length > 0) {
				this.ui.write(`Applications desired for device ${deviceId}:`);

				for (const appName of Object.keys(desiredApps)) {
					this.ui.write(appName);
				}

				this.ui.write('');
			} else {
				this.ui.write(`No applications desired for device ${deviceId}.${os.EOL}`);
			}

			const apps = deviceDoc.features?.applications?.properties?.apps;
			if (apps && Object.entries(apps).length > 0) {
				this.ui.write(`Applications running on device ${deviceId}:${os.EOL}`);

				for (const [appName, appDetails] of Object.entries(apps)) {
					this.ui.write(`App name: ${appName}`);

					// Create a table with headers
					const cols = (process.stdout.columns || 80) - 35;
					const table = new Table({
						head: ['Container', 'Details'],
						colWidths: [30, cols],
						style: { head: ['white'] }
					});
					for (const { name: container, ...containerDetails } of appDetails.containers) {
						table.push([container, JSON.stringify(containerDetails, null, 2)]);
					}
					this.ui.write(table.toString() + os.EOL);
				}
			} else {
				this.ui.write(`No applications running on device ${deviceId}.${os.EOL}`);
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

	async remove({ deviceId, appName }) {
		const device = await this._getDevice(deviceId, '.');
		deviceId = device.id;

		try {
			const { data: deviceDoc } = await this.api.getDocument({
				productId: device.product_id,
				deviceId: device.id,
				docName: 'system'
			});

			if (deviceDoc.features?.applications?.desiredProperties?.apps && deviceDoc.features.applications.desiredProperties.apps[appName]) {
				const patchOps = [{
					op: 'remove',
					path: `/features/applications/desiredProperties/apps/${appName}`
				}];

				await this.api.patchDocument({
					productId: device.product_id,
					deviceId: device.id,
					docName: 'system',
					patchOps
				});
				this.ui.write(`Successfully removed ${appName} from device ${deviceId}.${os.EOL}`);
			} else {
				this.ui.write(`Application ${appName} not found on device ${deviceId}.${os.EOL}`);
			}
		} catch (error) {
			if (error instanceof UnauthorizedError) {
				throw new Error('You must be logged in to remove an application. Run particle login and try again.');
			}
			if (error.statusCode === 404) {
				throw new Error(`${device.id} has no cloud application.`);
			}

			console.error(`Error removing application ${appName} from device ${deviceId}:`, error);
			throw error;
		}
	}

	async _getDevice(deviceId, blueprintDir) {
		let device;
		if (deviceId) {
			device = await this._getDeviceAttributes(deviceId);
		} else {
			device = await this._loadDeviceFromEnv(blueprintDir);
			if (device) {
				return device;
			}
			this.ui.write('Select a device for this operation from one of your existing products.\nThis device will be remembered for future operations.');
			device = await this._selectDevice(blueprintDir);
		}
		await this._saveDeviceToEnv(device, blueprintDir);
		return device;
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

	async _saveDeviceToEnv(device, blueprintDir) {
		// load existing env file and parse as yaml doc
		const envPath = path.join(blueprintDir, PARTICLE_ENV_FILE);
		let doc;
		try {
			const envContent = await fs.readFile(envPath, 'utf8');
			doc = yaml.parseDocument(envContent);
		} catch {
			doc = new yaml.Document();
		}
		doc.set('device_id', device.id);
		// save doc but only warn if it fails
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
};
