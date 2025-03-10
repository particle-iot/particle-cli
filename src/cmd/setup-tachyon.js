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
const { platformForId, PLATFORMS } = require('../lib/platform');
const path = require('path');

module.exports = class SetupTachyonCommands extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		spinnerMixin(this);
		this._setupApi();
		this.ui = ui || this.ui;
		this._userConfiguration = this._userConfiguration.bind(this);
		this._getSystemPassword = this._getSystemPassword.bind(this);
		this._getWifi = this._getWifi.bind(this);
		this._getKeys = this._getKeys.bind(this);
		this._runStepWithTiming = this._runStepWithTiming.bind(this);
		this._formatAndDisplaySteps = this._formatAndDisplaySteps.bind(this);
	}

	async setup({ skip_flashing_os: skipFlashingOs, region = 'NA', version = 'latest', timezone, load_config: loadConfig, save_config: saveConfig, variant = 'headless', board = 'formfactor', skip_cli: skipCli } = {}) {
		try {
			const loadedFromFile = !!loadConfig;
			this._showWelcomeMessage();
			this._formatAndDisplaySteps("Okay—first up! Checking if you're logged in...", 1);

			await this._verifyLogin();

			this.ui.write("...All set! You're logged in and ready to go!");

			let config = { timezone };
			let alwaysCleanCache = false;

			// load first since we need to know the product to create the registration code
			if (loadConfig) {
				alwaysCleanCache = true;
				config = await this._loadConfig(loadConfig);
				this.ui.write(
					`${os.EOL}${os.EOL}Skipping to Step 4 - Using configuration file: ` + loadConfig + `${os.EOL}`
				);
			} else {
				config = await this._runStepWithTiming(
					`Now lets capture some information about how you'd like your device to be configured when it first boots.${os.EOL}${os.EOL}` +
					`First, you'll be asked to set a password for the root account on your Tachyon device.${os.EOL}` +
					`Don't worry if you forget this—you can always reset your device later.${os.EOL}${os.EOL}` +
					`Next, you'll be prompted to provide an optional Wi-Fi network.${os.EOL}` +
					`While the 5G cellular connection will automatically connect, Wi-Fi is often much faster for use at home.${os.EOL}${os.EOL}` +
					`Finally, you'll have the option to add an SSH key from your local disk.${os.EOL}` +
					'This is optional—you can still SSH into the device using a password. Adding the key just allows for password-free access.',
					2,
					() => this._userConfiguration(),
					0
				);
				const product = await this._runStepWithTiming(
					`Next, let's select a Particle product for your Tachyon.${os.EOL}` +
					'A product will help manage the Tachyon device and keep things organized.',
					3,
					() => this._selectProduct()
				);
				config.productId = product;
			}

			const packagePath = await this._runStepWithTiming(
				`Next, we'll download the Tachyon Operating System image.${os.EOL}` +
        `Heads up: it's a large file — 3GB! Don't worry, though—the download will resume${os.EOL}` +
        `if it's interrupted. If you have to kill the CLI, it will pick up where it left. You can also${os.EOL}` +
        "just let it run in the background. We'll wait for you to be ready when its time to flash the device.",
				4,
				() => this._download({ region, version, alwaysCleanCache, variant, board })
			);

			const registrationCode = await this._runStepWithTiming(
				`Great! The download is complete.${os.EOL}` +
        "Now, let's register your product on the Particle platform.",
				5,
				() => this._getRegistrationCode(config.productId)
			);

			const { path: configBlobPath, configBlob } = await this._runStepWithTiming(
				'Creating the configuration file to write to the Tachyon device...',
				6,
				() => this._createConfigBlob({
					loadedFromFile,
					registrationCode,
					skipCli,
					...config
				})
			);
			const xmlPath = await this._createXmlFile(configBlobPath);
			// Save the config file if requested
			await this._saveConfig({ saveConfig, config: configBlob });

			const flashSuccessful = await this._runStepWithTiming(
				`Okay—last step! We're now flashing the device with the configuration, including the password, Wi-Fi settings, and operating system.${os.EOL}` +
        `Heads up: this is a large image and will take around 10 minutes to complete. Don't worry—we'll show a progress bar as we go!${os.EOL}${os.EOL}` +
        `Before we get started, we need to power on your Tachyon board:${os.EOL}${os.EOL}` +
        `1. Plug the USB-C cable into your computer and the Tachyon board.${os.EOL}` +
        `   The red light should turn on!${os.EOL}${os.EOL}` +
        `2. Put the Tachyon device into download mode:${os.EOL}` +
        `   - Hold the button next to the red LED for 3 seconds.${os.EOL}` +
        `   - When the light starts flashing yellow, release the button.${os.EOL}` +
        '   Your device is now in flashing mode!',
				7,
				() => this._flash({
					files: [packagePath, xmlPath],
					skipFlashingOs,
					silent: loadedFromFile
				})
			);

			if (flashSuccessful) {
				const product = this.api.getProduct({ product: config.productId });
				this._formatAndDisplaySteps(
					`All done! Your Tachyon device is now booting into the operating system and will automatically connect to Wi-Fi.${os.EOL}${os.EOL}` +
            `It will also:${os.EOL}` +
            `  - Activate the built-in 5G modem${os.EOL}` +
            `  - Connect to the Particle Cloud${os.EOL}` +
            `  - Run all system services, including battery charging${os.EOL}${os.EOL}` +
            `For more information about Tachyon, visit our developer site at: https://developer.particle.io!${os.EOL}` +
						`${os.EOL}` +
						`View your device on the Particle Console at: https://console.particle.io/${product.slug}${os.EOL}`,
					8
				);
			} else {
				this.ui.write(
					`${os.EOL}Flashing failed. Please unplug your device and rerun this. We're going to have to try it again.${os.EOL}` +
            `If it continues to fail, please select a different USB port or visit https://part.cl/setup-tachyon and the setup link for more information.${os.EOL}`
				);
			}

		} catch (error) {
			throw new Error(`${os.EOL}There was an error setting up Tachyon:${os.EOL}${os.EOL} >> ${error.message}${os.EOL}`);
		}
	}

	async _showWelcomeMessage() {
		this.ui.write(`
===================================================================================
			  Particle Tachyon Setup Command
===================================================================================

Welcome to the Particle Tachyon setup! This interactive command:

- Flashes your Tachyon device
- Configures it (password, WiFi credentials etc...)
- Connects it to the internet and the Particle Cloud!

**What you'll need:**

1. Your Tachyon device
2. The Tachyon battery
3. A USB-C cable

**Important:**
- This tool requires you to be logged into your Particle account.
- For more details, check out the documentation at: https://part.cl/setup-tachyon`);
	}

	_setupApi() {
		const { api } = this._particleApi();
		this.api = api;
	}

	async _runStepWithTiming(stepDesc, stepNumber, asyncTask, minDuration = 2000) {
		this._formatAndDisplaySteps(stepDesc, stepNumber);

		const startTime = Date.now();

		try {
			const result = await asyncTask();
			const elapsed = Date.now() - startTime;

			if (elapsed < minDuration) {
				await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed));
			}

			return result;
		} catch (err) {
			throw new Error(`Step ${stepNumber} failed with the following error: ${err.message}`);
		}
	}

	_formatAndDisplaySteps(text, step) {
		// Display the formatted step
		this.ui.write(`${os.EOL}===================================================================================${os.EOL}`);
		this.ui.write(`Step ${step}:${os.EOL}`);
		this.ui.write(`${text}${os.EOL}`);
	}

	async _loadConfig(loadConfig) {
		try {
			const data = fs.readFileSync(loadConfig, 'utf8');
			const config = JSON.parse(data);
			// validate the config fields
			const requiredFields = ['systemPassword', 'productId'];
			await this._validateConfig(config, requiredFields);
			return config;
		} catch (error) {
			throw new Error(`The configuration file is not a valid JSON file: ${error.message}`);
		}
	}

	async _validateConfig(config, requiredFields) {
		const missingFields = requiredFields.filter(field => !config[field]);
		if (missingFields.length) {
			throw new Error(`The configuration file is missing required fields: ${missingFields.join(', ')}`);
		}
	}

	async _verifyLogin() {
		const api = new ApiClient();
		try {
			api.ensureToken();
		} catch {
			const cloudCommand = new CloudCommand();
			await cloudCommand.login();
			this._setupApi();
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
		const { orgSlug } = await this._getOrg();

		let productId = await this._getProduct(orgSlug);

		if (!productId) {
			productId = await this._createProduct({ orgSlug });
		}
		return productId;
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
		const productsResp = await this.ui.showBusySpinnerUntilResolved(`Fetching products for ${orgSlug || 'sandbox'}`, this.api.getProducts(orgSlug));
		let newProductName = 'Create a new product';
		let products = productsResp?.products || [];


		products = products.filter((product) => platformForId(product.platform_id)?.name === 'tachyon');

		if (!products.length) {
			return null; // No products available
		}

		const selectedProductName = await this._promptForProduct([...products.map(product => product.name), newProductName]);

		const selectedProduct =  selectedProductName !== newProductName ? (products.find(p => p.name === selectedProductName)) : null;
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

	async _createProduct({ orgSlug }) {
		const platformId = PLATFORMS.find(p => p.name === 'tachyon').id;
		const question = [{
			type: 'input',
			name: 'productName',
			message: 'Enter the product name:',
			validate: (value) => {
				if (value.length === 0) {
					return 'You need to provide a product name';
				}
				return true;
			}
		}, {
			type: 'input',
			name: 'locationOptIn',
			message: 'Would you like to opt in to location services? (y/n):',
			default: 'y'
		}];
		const { productName, locationOptIn } = await this.ui.prompt(question);
		const { product } = await this.api.createProduct({
			name: productName,
			platformId,
			orgSlug,
			locationOptIn: locationOptIn.toLowerCase() === 'y'
		});
		this.ui.write(`Product ${product.name} created successfully!`);
		return product?.id;
	}

	async _userConfiguration() {
		const systemPassword = await this._getSystemPassword();
		const wifi = await this._getWifi();
		return { systemPassword, wifi };
	}

	async _download({ region, version, alwaysCleanCache, variant, board }) {
		//before downloading a file, we need to check if 'version' is a local file or directory
		//if it is a local file or directory, we need to return the path to the file
		if (fs.existsSync(version)) {
			return version;
		}

		const manager = new DownloadManager(this.ui);
		const manifest = await manager.fetchManifest({ version });
		const build = manifest?.builds.find(build => build.region === region && build.variant === variant && build.board === board);
		if (!build) {
			throw new Error('No build available for the provided parameters');
		}
		const artifact = build.artifacts[0];
		const url = artifact.artifact_url;
		const outputFileName = url.replace(/.*\//, '');
		const expectedChecksum = artifact.sha256_checksum;

		return manager.download({ url, outputFileName, expectedChecksum, options: { alwaysCleanCache } });
	}

	async _getSystemPassword() {
		let password = '';
		while (password === '') {
			password = await this.ui.promptPasswordWithConfirmation({
				customMessage: 'Enter a password for the system account:',
				customConfirmationMessage: 'Re-enter the password for the system account:'
			});
			if (password === '') {
				this.ui.write('System password cannot be blank.');
			}
		}
		return password;
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
			}
		];
		const res = await this.ui.prompt(questions);
		const password = await this.ui.promptPasswordWithConfirmation({
			customMessage: 'Enter your WiFi password:',
			customConfirmationMessage: 'Re-enter your WiFi password:'
		});

		return { ssid: res.ssid, password };
	}

	async _getRegistrationCode(product) {
		const data = await this.api.getRegistrationCode(product);
		return data.registration_code;
	}

	async _createConfigBlob({ loadedFromFile = false, registrationCode, systemPassword, wifi, sshPublicKey, productId, timezone, skipCli }) {
		// Format the config and registration code into a config blob (JSON file, prefixed by the file size)
		const config = {
			registrationCode: registrationCode,
			systemPassword : loadedFromFile ? systemPassword : this._generateShadowCompatibleHash(systemPassword)
		};

		if (wifi) {
			config.wifi = wifi;
		}

		if (sshPublicKey) {
			config.sshPublicKey = sshPublicKey;
		}

		if (productId) {
			config.productId = productId;
		}

		config.timezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

		if (!skipCli) {
			const profileFile = settings.findOverridesFile();
			if (await fs.exists(profileFile)) {
				config.cliConfig = await fs.readFile(profileFile, 'utf8');
			}
		}

		// Write config JSON to a temporary file (generate a filename with the temp npm module)
		// prefixed by the JSON string length as a 32 bit integer
		let jsonString = JSON.stringify(config, null, 2);
		const buffer = Buffer.alloc(4 + Buffer.byteLength(jsonString));
		buffer.writeUInt32BE(Buffer.byteLength(jsonString), 0);
		buffer.write(jsonString, 4);

		const tempFile = temp.openSync();
		fs.writeSync(tempFile.fd, buffer);
		fs.closeSync(tempFile.fd);

		return { path: tempFile.path, configBlob: config };
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
			'</data>',
			''
		].join('\n'); // Must use UNIX line endings for QDL

		// Create a temporary file for the XML content
		const tempFile = temp.openSync({ prefix: 'config', suffix: '.xml' });
		fs.writeSync(tempFile.fd, xmlContent, 0, xmlContent.length, 0);
		fs.closeSync(tempFile.fd);
		return tempFile.path;
	}

	async _flash({ files, skipFlashingOs, output, silent = false }) {

		const packagePath = files[0];

		if (!silent) {
			const question = {
				type: 'confirm',
				name: 'flash',
				message: 'Is the device powered, its LED flashing yellow and a USB-C cable plugged in from your computer?',
				default: true
			};
			await this.ui.prompt(question);
		}

		const flashCommand = new FlashCommand();

		if (output && !fs.existsSync(output)) {
			fs.mkdirSync(output);
		}
		const outputLog = path.join(process.cwd(), `tachyon_flash_${Date.now()}.log`);
		fs.ensureFileSync(outputLog);

		this.ui.write(`${os.EOL}Starting download. See logs at: ${outputLog}${os.EOL}`);
		if (!skipFlashingOs) {
			await flashCommand.flashTachyon({ files: [packagePath], skipReset: true, output: outputLog, verbose: false });
		}
		await flashCommand.flashTachyonXml({ files, output: outputLog });
		return true;
	}

	async _saveConfig({ saveConfig, config } = {}) {
		if (saveConfig) {
			// eslint-disable-next-line no-unused-vars
			const { registrationCode, ...savedConfig } = config;
			fs.writeFile(saveConfig, JSON.stringify(savedConfig, null, 2));
			this.ui.write(`${os.EOL}Configuration file written here: ${saveConfig}${os.EOL}`);
		}
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
