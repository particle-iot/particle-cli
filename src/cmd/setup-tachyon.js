const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');
const fs = require('fs-extra');
const ParticleApi = require('./api');
const settings = require('../../settings');
const createApiCache = require('../lib/api-cache');
const ApiClient = require('../lib/api-client');
const crypto = require('crypto');
const temp = require('temp').track();
const os = require('os');
const FlashCommand = require('./flash');
const CloudCommand = require('./cloud');
const { sha512crypt } = require('sha512crypt-node');
const DownloadManager = require('../lib/download-manager');
const { platformForId } = require('../lib/platform');

module.exports = class SetupTachyonCommands extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		spinnerMixin(this);
		const { api } = this._particleApi();
		this.api = api;
		this.ui = ui || this.ui;
	}

	async setup() {
		try {
			await this._verifyLogin();

			const region = await this._selectRegion();

			const version = await this._selectVersion();

			const product = await this._selectProduct();

			const { systemPassword, sshPublicKey, wifi } = await this._userConfiguration();

			const packagePath = await this._download({ region, version });

			const registrationCode = await this._getRegistrationCode(product);

			const configBlobPath = await this._createConfigBlob({ registrationCode, systemPassword, wifi, sshPublicKey });

			const xmlPath = await this._createXmlFile(configBlobPath);

			await this._flash(packagePath, xmlPath);

			this.ui.write('Tachyon setup complete. Device will boot and connect to the Particle Cloud.');

		} catch (error) {
			throw new Error(`Error setting up Tachyon: ${error.message}`);
		}
	}

	async _verifyLogin() {
		const api = new ApiClient();
		try {
			api.ensureToken();
		} catch {
			const cloudCommand = new CloudCommand();
			await cloudCommand.login();
		}
	}

	async _selectRegion() {
		const regionMapping = {
			'NA (North America)': 'NA',
			'RoW (Rest of the World)': 'RoW'
		};
		const question = [
			{
				type: 'list',
				name: 'region',
				message: 'Select the region:',
				choices: Object.keys(regionMapping),
			},
		];
		const { region } = await this.ui.prompt(question);
		return regionMapping[region];
	}

	async _selectVersion() {
		const question = [
			{
				type: 'input',
				name: 'version',
				message: 'Enter the version number:',
				default: 'latest',
			},
		];
		const answer = await this.ui.prompt(question);
		return answer.version;
	}

	async _selectProduct() {
		const orgSlug = await this._getOrg();

		let productId = await this._getProduct(orgSlug);

		if (!productId) {
			productId = await this._createProduct(orgSlug);
		}
		return productId;
	}

	async _getOrg() {
		const orgsResp = await this.api.getOrgs();
		const orgs = orgsResp.organizations;

		const orgName = orgs.length
			? await this._promptForOrg([...orgs.map(org => org.name), 'Sandbox'])
			: 'Sandbox';

		return orgName !== 'Sandbox' ? orgs.find(org => org.name === orgName).slug : null;
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
		const products = productsResp.products.filter((product) => platformForId(product.platform_id)?.name === 'tachyon');

		if (!products.length) {
			return null; // No products available
		}

		const selectedProductName = await this._promptForProduct(products.map(product => product.name));

		const selectedProduct = products.find(p => p.name === selectedProductName);
		return selectedProduct?.id || null;
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

	async _createProduct(orgSlug) {
		// It appears that CLI code base does not have a method to create a product readily available
		// TODO: Discuss with the team to add a method to create a product
		// For now though, we will return an error
		throw new Error('No products available. Create a product in the console and return to continue.');
	}

	async _userConfiguration() {
		const systemPassword = await this._getSystemPassword();

		const wifi = await this._getWifi();

		const sshPublicKey = await this._getKeys();

		return { systemPassword, wifi, sshPublicKey };
	}

	async _download({ region, version }) {
		const manager = new DownloadManager(this.ui);
		const manifest = await manager.fetchManifest({ version });
		const build = manifest?.builds.find(build => build.region === region);
		if (!build) {
			throw new Error('No builds available for the selected region');
		}
		const artifact = build.artifacts[0];
		const url = artifact.artifact_url;
		const outputFileName = url.replace(/.*\//, '');
		const expectedChecksum = artifact.sha256_checksum;

		await manager.download({ url, outputFileName, expectedChecksum });
	}

	async _getSystemPassword() {
		const question = [
			{
				type: 'password',
				name: 'password',
				message: 'Password for the system account:',
				validate: (value) => {
					if (!value) {
						return 'You need a password for the system account';
					}
					return true;
				}
			},
		];
		const answer = await this.ui.prompt(question);
		return answer.password;
	}

	async _getWifi() {
		const question = [
			{
				type: 'input',
				name: 'setupWifi',
				message: 'Would you like to set up WiFi for your device? (y/n):',
				default: 'y',
			}
		];
		const { setupWifi } = await this.ui.prompt(question);
		if (setupWifi.toLowerCase() === 'y') {
			return this._getWifiCredentials();
		}

		return null;
	}

	async _getWifiCredentials() {
		const questions = [
			{
				type: 'input',
				name: 'ssid',
				message: 'Enter your WiFi SSID:'
			},
			{
				type: 'password',
				name: 'password',
				message: 'Enter your WiFi password:'
			},
		];
		const res = await this.ui.prompt(questions);
		return { ssid: res.ssid, password: res.password };
	}

	async _getKeys() {
		let question = [
			{
				type: 'input',
				name: 'addKey',
				message: 'Would you like to add an SSH key to log in to your device? (y/n):',
				default: 'y',
			}
		];
		const { addKey } = await this.ui.prompt(question);
		if (addKey.toLowerCase() !== 'y') {
			return;
		}

		question = [
			{
				type: 'input',
				name: 'sshKey',
				message: 'Enter the path to your SSH public key:',
				validate: (value) => {
					if (!fs.existsSync(value)) {
						return 'You need to provide a path to your SSH public key';
					}
					return true;
				}
			},
		];

		const { sshKey } = await this.ui.prompt(question);
		return fs.readFileSync(sshKey, 'utf8');
	}

	async _getRegistrationCode(product) {
		const data = await this.api.getRegistrationCode(product);
		return data.registration_code;
	}

	async _createConfigBlob({ registrationCode, systemPassword, wifi, sshKey }) {
		// Format the config and registration code into a config blob (JSON file, prefixed by the file size)
		const config = {
			registration_code: registrationCode,
			system_password : this._generateShadowCompatibleHash(systemPassword),
		};

		if (wifi) {
			config.wifi = wifi;
		}

		if (sshKey) {
			config.ssh_key = sshKey;
		}

		// Write config JSON to a temporary file (generate a filename with the temp npm module)
		// prefixed by the JSON string length as a 32 bit integer
		let jsonString = JSON.stringify(config);
		const buffer = Buffer.alloc(4 + Buffer.byteLength(jsonString));
		buffer.writeUInt32BE(Buffer.byteLength(jsonString), 0);
		buffer.write(jsonString, 4);

		const tempFile = temp.openSync();
		fs.writeSync(tempFile.fd, buffer);
		fs.closeSync(tempFile.fd);

		return tempFile.path;
	}

	_generateShadowCompatibleHash(password) {
		const salt = crypto.randomBytes(12).toString('base64');
		return sha512crypt(password, `$6$${salt}`);
	}

	async _createXmlFile(configBlobPath) {
		const xmlContent = [
			'<?xml version="1.0" ?>',
			'<data>',
			'    <program',
			'        SECTOR_SIZE_IN_BYTES="4096"',
			'        file_sector_offset="0"',
			`        filename="${configBlobPath}"`,
			'        label="misc"',
			'        num_partition_sectors="256"',
			'        partofsingleimage="false"',
			'        physical_partition_number="0"',
			'        readbackverify="false"',
			'        size_in_KB="1024.0"',
			'        sparse="false"',
			'        start_byte_hex="0x2208000"',
			'        start_sector="8712"',
			'    />',
			'</data>'
		].join(os.EOL);

		// Create a temporary file for the XML content
		const tempFile = temp.openSync();
		fs.writeSync(tempFile.fd, xmlContent, 0, xmlContent.length, 0);
		fs.closeSync(tempFile.fd);
		return tempFile.path;
	}

	async _flash(packagePath, xmlPath) {
		const flashCommand = new FlashCommand();
		await flashCommand.flashTachyon({ files : [packagePath, xmlPath] });
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
