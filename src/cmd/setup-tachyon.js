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
    this._userConfiguration = this._userConfiguration.bind(this);
    this._getSystemPassword = this._getSystemPassword.bind(this);
    this._getWifi = this._getWifi.bind(this);
    this._getKeys = this._getKeys.bind(this);
    this._runStepWithTiming = this._runStepWithTiming.bind(this);
    this._formatAndDisplaySteps = this._formatAndDisplaySteps.bind(this);
	}

	async setup({ skip_flashing_os, version, load_config, save_config }) {
		try {
      this.ui.write(`
===========================================================
              Particle Tachyon Setup Command
===========================================================

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

      this._formatAndDisplaySteps("Okay—first up! Checking if you're logged in...", 1);

      await this._verifyLogin();

      this.ui.write("...All set! You're logged in and ready to go!");

			const region = 'NA'; //await this._selectRegion();

      //if version is not provided, set to latest
      if (!version) {
			    version = 'latest'; //await this._selectVersion();
      }

      let config = { systemPassword: null, wifi: null, sshPublicKey: null };

      if( !load_config ) {
          config = await this._runStepWithTiming(
              "Now lets capture some information about how you'd like your device to be configured when it first boots.\n\n" +
              "First, you'll be asked to set a password for the root account on your Tachyon device.\n" +
              "Don't worry if you forget this—you can always reset your device later.\n\n" +
              "Next, you'll be prompted to provide an optional Wi-Fi network.\n" +
              "While the 5G cellular connection will automatically connect, Wi-Fi is often much faster for use at home.\n\n" +
              "Finally, you'll have the option to add an SSH key from your local disk.\n" +
              "This is optional—you can still SSH into the device using a password. Adding the key just allows for password-free access.",
              2,
              () => this._userConfiguration(),
              0
          )
      } else {
        this.ui.write(
          "\n\nSkipping Step 3 - Using configuration file: " + load_config + "\n"
        );        
      }

      const product = await this._runStepWithTiming(
        "Next, let's select a Particle organization that you are part of.\n" +
        "This organization will help manage the Tachyon device and keep things organized.\n\n" +
        "Once you've selected an organization, you can then choose which product the device will belong to.",
        3,
        () => this._selectProduct()
      );

      const packagePath = await this._runStepWithTiming(
        "Next, we'll download the Tachyon Operating System image.\n" +
        "Heads up: it's a large file — 2.6GB! Don't worry, though—the download will resume\n" +
        "if it's interrupted. If you have to kill the CLI, it will pick up where it left. You can also\n" +
        "just let it run in the background. We'll wait for you to be ready when its time to flash the device.",
        4,
        () => this._download({ region, version })
      );

      const registrationCode = await this._runStepWithTiming(
        "Great! The download is complete.\n" +
        "Now, let's register your product on the Particle platform.",
        5,
        () => this._getRegistrationCode(product)
      );

      let configBlobPath = load_config;
      if (configBlobPath) {
        this.ui.write(
          "\n\nSkipping Step 6 - Using configuration file: " + load_config + "\n"
        );
      }
      else {
        configBlobPath = await this._runStepWithTiming(
          "Creating the configuration file to write to the Tachyon device...",
          6,
          () => this._createConfigBlob({ registrationCode, ...config })
        );
      }
      const xmlPath = await this._createXmlFile(configBlobPath);

      if (save_config) {
          this.ui.write(`\n\nConfiguration file written here: ${save_config}\n`);
          fs.copyFileSync(configBlobPath, save_config);
      }

      //what files to flash? 
      const filesToFlash = skip_flashing_os ? [xmlPath] : [packagePath, xmlPath];

      const flashSuccessful = await this._runStepWithTiming(
        "Okay—last step! We're now flashing the device with the configuration, including the password, Wi-Fi settings, and operating system.\n" +
        "Heads up: this is a large image and will take around 10 minutes to complete. Don't worry—we'll show a progress bar as we go!\n\n" +
        "Before we get started, we need to power on your Tachyon board:\n\n" +
        "1. Plug the USB-C cable into your computer and the Tachyon board.\n" +
        "   The red light should turn on!\n\n" +
        "2. Put the Tachyon device into download mode:\n" +
        "   - Hold the button next to the red LED for 3 seconds.\n" +
        "   - When the light starts flashing yellow, release the button.\n" +
        "   Your device is now in flashing mode!",
        7,
        () => this._flash(filesToFlash)
      );

      if (flashSuccessful) {
          this._formatAndDisplaySteps(
            "All done! Your Tachyon device is now booting into the operating system and will automatically connect to Wi-Fi.\n\n" +
            "It will also:\n" +
            "  - Activate the built-in 5G modem\n" +
            "  - Connect to the Particle Cloud\n" +
            "  - Run all system services, including battery charging\n\n" +
            "For more information about Tachyon, visit our developer site at: developer.particle.io!",
            8
          );
      } else {
          this.ui.write(
            "\nFlashing failed. Please unplug your device and rerun this. We're going to have to try it again.\n" +
            "If it continues to fail, please select a different USB port or visit https://part.cl/setup-tachyon and the setup link for more information.\n"
          );
      }

		} catch (error) {
			throw new Error(`Error setting up Tachyon: ${error.message}`);
		}
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
        throw new Error(`Step ${stepNumber} failed: ${err.message}`);
    }
  }

  async _formatAndDisplaySteps(text, step) {
    // Display the formatted step
    this.ui.write("\n===========================================================\n");
    this.ui.write(`Step ${step}:\n`);
    this.ui.write(`${text}\n`);
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
		const { orgName, orgSlug } = await this._getOrg();

		let productId = await this._getProduct(orgName, orgSlug);

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

	async _getProduct(orgName, orgSlug) {
		const productsResp = await this.api.getProducts(orgSlug);

    //if orgSlug is not null, filter for this org from product.organization_id
    //if orgSlug is null, filter for an empty field in product.organization_id
    let products = [];
    if (orgSlug) {
      products = productsResp.products.filter((product) => product.org === orgName);
    } else {
      products = productsResp.products.filter((product) => !product.org);
    }

		products = products.filter((product) => platformForId(product.platform_id)?.name === 'tachyon');

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

    //before downloading a file, we need to check if 'version' is a local file or directory
    //if it is a local file or directory, we need to return the path to the file
    if (fs.existsSync(version)) {
      return version;
    }

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

		return manager.download({ url, outputFileName, expectedChecksum });
	}

	async _getSystemPassword() {
		const questions = [
			{
				type: 'password',
				name: 'password',
				message: 'Password for the system account:',
				validate: (value) => {
					if (!value) {
						return 'Enter a password for the root account';
					}
					return true;
				}
			},
			{
				type: 'password',
				name: 'passwordConfirm',
				message: 'Re-enter the password for the root account:',
				validate: (value) => {
					if (!value) {
						return 'You need to confirm the password';
					}
					return true;
				}
			}
		];
		const res = await this.ui.prompt(questions);

    //check if the passwords match
    if (res.password !== res.passwordConfirm) {
      throw new Error("Passwords do not match. Please try again.");
    }

		return res.password;
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
			{
				type: 'password',
				name: 'passwordConfirm',
				message: 'Re-enter your WiFi password:'
			},
		];
		const res = await this.ui.prompt(questions);

    if (res.password !== res.passwordConfirm) {
      throw new Error("Passwords do not match. Please try again.");
    }

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

	async _flash(files) {
    const question = {
      type: 'confirm',
      name: 'flash',
      message: 'Is the device powered, its LED flashing yellow and a USB-C cable plugged in from your computer?',
      default: true
    };
		await this.ui.prompt(question);

		const flashCommand = new FlashCommand();
		return await flashCommand.flashTachyon({ files });
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
