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

			const packagePath = await this._download(region, version, product, systemPassword, sshPublicKey);

			const regCode = await this._getRegistrationCode(product);

			const configBlobPath = await this._createConfigBlob(regCode, systemPassword, wifi?.ssid, wifi?.password, sshPublicKey);

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
			// User not logged in, prompt to login
			const choice = await this._promptForLoginType();
			const cloudCommand = new CloudCommand();
			if (choice === 'token') {
                const resp = await this.ui.prompt([
                    {
                        type: 'input',
                        name: 'token',
                        message: 'Enter your access token:',
                    },
                ]);
				await cloudCommand.login({ token: resp.token });
			} else {
				await cloudCommand.login();
			}
			// If there was a problem logging in, this method throws an error
		}
	}

	async _promptForLoginType() {
		const choicesMapping = {
			'Access Token': 'token',
			'Credentials': 'credentials',
            // 'SSO': 'sso',
			// 'OTP': 'otp',
		};
		const question = [
			{
				type: 'list',
				name: 'login',
				message: 'Login using:',
				choices: Object.keys(choicesMapping),
			},
		];
		const { login } = await this.ui.prompt(question);
		return choicesMapping[login];
	}

	async _selectRegion() {
		const regionMapping = {
			'NA (North America)': 'na',
			'ROW (Rest of the World)': 'row'
		};
		const question = [
			{
				type: 'list',
				name: 'region',
				message: 'Select a region:',
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
				default: 'default',
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
		const products = productsResp.products;

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

	async _getSystemPassword() {
		const question = [
			{
				type: 'input',
				name: 'password',
				message: 'Password for the system account (required):',
				default: 'default',
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
				default: true,
			}
		];
		const { setupWifi } = await this.ui.prompt(question);
		if (setupWifi === 'y') {
			// TODO: Double check the WiFi credentials with the user
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
		const confirmQuestion = [
			{
				type: 'input',
				name: 'confirm',
				message: `Are these credentials correct? (y/n)\nSSID: ${res.ssid}\nPassword: ${res.password}`
			}
		];
		const { confirm } = await this.ui.prompt(confirmQuestion);
		if (confirm === 'n') {
			return this._getWifiCredentials();
		}

		return { ssid: res.ssid, password: res.password };
	}

	async _getKeys() {
		const question = [
			{
				type: 'input',
				name: 'sshKey',
				message: 'Enter the path to your SSH public key:'
			},
		];

		const { sshKey } = await this.ui.prompt(question);
		if (!fs.existsSync(sshKey)) {
			return this._getKeys();
		}

		return fs.readFileSync(sshKey, 'utf8');
	}

	async _getRegistrationCode(product) {
		return this.api.getRegistrationCode(product);
	}

	async _createConfigBlob(regCode, systemPassword, wifiSsid, wifiPassword, sshKey) {
		// Format the config and registration code into a config blob (JSON file, prefixed by the file size)
		const config = {
			registration_code: regCode,
			system_password : _generateShadowCompatibleHash(systemPassword),
			wifi: {
				ssid: wifiSsid,
				password: wifiPassword,
			},
			ssh_key : sshKey,
		};

		// Write config JSON to a temporary file (generate a filename with the temp npm module)
		// prefixed by the JSON string length as a 32 bit integer
		let jsonString = JSON.stringify(config);
		const buffer = Buffer.alloc(4 + Buffer.byteLength(jsonString));
		buffer.writeInt32LE(Buffer.byteLength(jsonString), 0);
		buffer.write(jsonString, 4);

		const tempFile = temp.openSync();
		fs.writeSync(tempFile.fd, buffer);
		fs.closeSync(tempFile.fd);

		return tempFile.path;
	}

	_generateShadowCompatibleHash(password) {
		const salt = crypto.randomBytes(16).toString('hex');
		const hash = crypto.createHash('sha512');
		hash.update(salt + password);
		const value = hash.digest('hex');
		return `$6$${salt}$${value}`;
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
