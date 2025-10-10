const os = require('os');
const crypto = require('crypto');
const settings = require('../../../settings');
const { sha512crypt } = require('sha512crypt-node');
const { promptWifiNetworks } = require('../tachyon-utils');
const { platformForId, PLATFORMS } = require('../platform');
const { supportedCountries } = require('../supported-countries');
const DownloadManager = require('../download-manager');


/**
 *
 * @param {Workflow} workflow
 * @return {Promise<Object>}
 */
async function pickVariant({ ui, workflow, manifest, version, log, isLocalVersion, variant, board }, stepIndex){
	let selectedVariant;
	if (variant) {
		selectedVariant = variant;
		ui.write(os.EOL);
		ui.write(`Skipping step ${stepIndex}: Using current variant: ${selectedVariant}`);
	} else if (workflow.variants.length > 1){
		const text = `Select the variant of the Tachyon operating system to set up.${os.EOL}` +
			`The 'desktop' includes a GUI and is best for interacting with the device with a keyboard, mouse, and display.${os.EOL}` +
			`The 'headless' variant is accessed only by a terminal out of the box. ${os.EOL}`;

		formatAndDisplaySteps({
			ui,
			text,
			step: stepIndex
		});
		const choices = workflow.variants;
		const question = [{
			type: 'list',
			name: 'selectedVariant',
			message: 'Select the OS variant:',
			choices
		}];
		const answer = await ui.prompt(question);
		selectedVariant = answer.selectedVariant;
	} else {
		selectedVariant = workflow.variants[0].value;
		ui.write(`Skipping step ${stepIndex}: Using default OS variant ${selectedVariant} ${os.EOL}`);
	}
	log.info(`picking OS variant: ${selectedVariant}`);
	// return url to be stored in context
	if (!isLocalVersion) {
		const build = manifest.find(build => build.variant === selectedVariant);
		if (!build) {
			throw new Error(`No builds found for this variant ${selectedVariant}, board ${board} and version ${version}`);
		}
		const artifact = build.artifacts[0];
		return {
			url: artifact.artifact_url,
			expectedChecksum: artifact.sha256_checksum,
			variant: selectedVariant,
			buildVersion: build.version
		};
	}
	return { variant: selectedVariant };
}

/**
 * Step Download OS
 * @param {Pick<Context, 'ui' | 'alwaysCleanCache' | 'isLocalVersion' | 'version' | 'url' | 'expectedChecksum'>} context
 * @param {Number} stepIndex - Index of the step
 * @return {Promise<{osFilePath: *}|*>}
 */
async function downloadOS({ ui, alwaysCleanCache, isLocalVersion, version, url, buildVersion, expectedChecksum }, stepIndex) {
	if (isLocalVersion) {
		ui.write(`Skipping step ${stepIndex}: Using local version ${version}`);
		return { version, osFilePath: version };
	}
	formatAndDisplaySteps({
		ui,
		text: `Downloading OS version: ${buildVersion}${os.EOL}`,
		step: stepIndex
	});

	const downloadManager = new DownloadManager(ui);

	const outputFileName = url.replace(/.*\//, '');
	const osFilePath = await downloadManager.download({
		url,
		outputFileName,
		expectedChecksum,
		options: { alwaysCleanCache }
	});
	return { osFilePath };
}

/**
 *
 * @param {Pick <Context, 'workflow' | 'variant' | 'version' | 'region' | 'ui'>} context
 * @return {Promise<void>}
 */
async function printOSInfo({ workflow, variant, buildVersion, version, region, ui }) {
	const { distribution, distributionVersion } = workflow.osInfo;
	ui.write(os.EOL);
	ui.write(ui.chalk.bold('Operating system information:'));
	ui.write(ui.chalk.bold(`Tachyon ${distribution.toUpperCase()} ${distributionVersion} (${variant}, ${region} region)`));
	ui.write(`${ui.chalk.bold('Version:')} ${buildVersion || version }`);
}

/**
 *
 * @param {Pick <Context, ui'>} context
 * @return {Promise<{systemPaswsword, wifi}>}
 */
async function getUserConfigurationStep({ ui, systemPassword, wifi }, stepIndex) {
	if (systemPassword && wifi) {
		ui.write(os.EOL);
		ui.write(`Skipping step ${stepIndex}: Using stored user configuration`);
		return { systemPassword, wifi };
	}
	return runStepWithTiming(
		ui,
		`Now let's capture some information about how you'd like your device to be configured when it first boots.${os.EOL}${os.EOL}` +
		`First, pick a password for the root account on your Tachyon device.${os.EOL}` +
		`This same password is also used for the "particle" user account.${os.EOL}`,
		stepIndex,
		() => getUserConfiguration({ ui }),
		0
	);
}

async function getUserConfiguration({ ui }) {
	const password = await getSystemPassword({ ui });
	const systemPassword = _generateShadowCompatibleHash(password);
	const wifi = await getWifiConfiguration({ ui });

	return { systemPassword, wifi };
}

async function getSystemPassword({ ui }) {
	let password = '';
	while (password === '') {
		password = await ui.promptPasswordWithConfirmation({
			customMessage: 'Enter a password for the root and particle accounts:',
			customConfirmationMessage: 'Re-enter the password for the root and particle accounts:'
		});
		if (password === '') {
			ui.write('System password cannot be blank.');
		}
	}
	return password;
}

function _generateShadowCompatibleHash(password) {
	// crypt uses . instead of + for base64
	const salt = crypto.randomBytes(12).toString('base64').replaceAll('+', '.');
	return sha512crypt(password, `$6$${salt}`);
}

async function getWifiConfiguration({ ui }) {
	ui.write(
		ui.chalk.bold(
			`${os.EOL}` +
			`Next, provide a Wi-Fi network for your device to connect to the internet.${os.EOL}` +
			`An internet connection is necessary to activate 5G cellular connectivity on your device.${os.EOL}`
		)
	);
	return promptWifiNetworks(ui);
}

async function configureProductStep({ ui, api, productId, deviceInfo }, stepIndex) {
	formatAndDisplaySteps({
		ui,
		text: `Next, let's select a Particle product for your Tachyon.${os.EOL}` +
			'A product will help manage the Tachyon device and keep things organized.',
		step: stepIndex,
	});
	let selectedProductId = productId;
	if (!selectedProductId) {
		selectedProductId = await selectProduct({ ui, api });
	}
	const { product } = await api.getProduct({ product: selectedProductId });

	await assignDeviceToProduct({
		productId: selectedProductId,
		deviceId: deviceInfo.deviceId,
		productSlug: product.slug,
		ui,
		api
	});

	return { productSlug: product.slug, productId: selectedProductId };
}

async function selectProduct({ ui, api }) {
	const { orgSlug } = await getOrg({ ui, api });

	let productId = await getProduct({ orgSlug, ui, api });

	if (!productId) {
		productId = await createProduct({ orgSlug, ui, api });
	}

	return { productId };
}

async function createProduct({ orgSlug, ui, api }) {
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
	const { productName, locationOptIn } = await ui.prompt(question);
	const { product } = await api.createProduct({
		name: productName,
		platformId,
		orgSlug,
		locationOptIn: locationOptIn.toLowerCase() === 'y'
	});
	ui.write(`Product ${product.name} created successfully!`);
	return product?.id;
}


async function getOrg({ api, ui }) {
	const orgsResp = await api.getOrgs();
	const orgs = orgsResp.organizations;

	const orgName = orgs.length
		? await ui.promptForList(
			'Select an organization:',
			[...orgs.map(org => org.name), 'Sandbox'])
		: 'Sandbox';

	const orgSlug = orgName !== 'Sandbox' ? orgs.find(org => org.name === orgName).slug : null;
	return { orgName, orgSlug };
}

async function getProduct({ orgSlug, ui, api }) {
	const productsResp = await ui.showBusySpinnerUntilResolved(
		`Fetching products for ${orgSlug || 'sandbox'}`,
		api.getProducts(orgSlug));
	let newProductName = 'Create a new product';
	let products = productsResp?.products || [];


	products = products.filter((product) => platformForId(product.platform_id)?.name === 'tachyon');

	if (!products.length) {
		return null; // No products available
	}

	const selectedProductName = await ui.promptForList(
		'Select a product',
		[...products.map(product => product.name), newProductName]);

	const selectedProduct =  selectedProductName !== newProductName ?
		(products.find(p => p.name === selectedProductName)) :
		null;
	return selectedProduct?.id || null;
}

async function assignDeviceToProduct({ deviceId, productId, ui, api, productSlug }) {
	const data = await api.addDeviceToProduct(deviceId, productId);
	if (data.updatedDeviceIds.length === 0 && data.existingDeviceIds.length === 0) {
		let errorDescription = '';
		if (data.invalidDeviceIds.length > 0) {
			errorDescription = ': Invalid device ID';
		}
		if (data.nonmemberDeviceIds.length > 0) {
			errorDescription = ': Device is owned by another user';
		}
		throw new Error(`Failed to assign device ${deviceId} ${errorDescription}`);
	}
	ui.write(`Device ${deviceId} Assigned to the product ${productSlug}`);
}

async function getCountryStep({ ui, country, silent }, stepIndex	) {
	if (silent) {
		ui.write(`${os.EOL}`);
		ui.write(`Skipping step: ${stepIndex}: Using country ${country}`);
		return { country };
	}

	return runStepWithTiming(
		ui,
		`Next, let's configure the cellular connection for your Tachyon!.${os.EOL}` +
		'Select from the list of countries supported for the built in Particle cellular ' +
		`connection or select 'Other' if your country is not listed.${os.EOL}` +
		'For more information, visit: https://developer.particle.io/redirect/tachyon-cellular-setup',
		stepIndex,
		() => promptForCountry({ ui, country }),
		0
	);
}

async function promptForCountry({ ui, country }) {
	const question = [
		{
			type: 'list',
			name: 'countryCode',
			message: 'Select your country:',
			choices: [...supportedCountries, new ui.Separator()],
			default: country
		},
	];
	const { countryCode } = await ui.prompt(question);
	settings.profile_json.country = countryCode;
	settings.saveProfileData();
	if (countryCode === 'OTHER') {
		ui.write('No cellular profile will be enabled for your device');
	}
	return { country: countryCode };
}

async function registerDeviceStep({ ui, api, productId, deviceInfo }, stepIndex) {
	formatAndDisplaySteps({
		ui,
		text: `Great! The download is complete.${os.EOL}` +
			"Now, let's register your product on the Particle platform.",
		step: stepIndex
	});
	const { registration_code: registrationCode } = await api.getRegistrationCode({
		productId,
		deviceId: deviceInfo.deviceId,
	});
	return { registrationCode };
}

async function getESIMProfilesStep({ api, ui, deviceInfo, productId, country }, stepIndex){
	let esim = null;
	formatAndDisplaySteps({
		ui,
		text: `Now let's get the eSIM profiles for your device ${os.EOL}`,
		step: stepIndex,
	});
	try {
		esim = await api.getESIMProfiles(deviceInfo.deviceId, productId, country);
	} catch (error) {
		const message = `Error getting eSIM profiles: ${error.message}${os.EOL}`;
		ui.write(this.ui.chalk.yellow(message));
	}
	return { esim };
}

async function setupCompletedStep({ ui, variant, flashSuccessful, productSlug, deviceInfo }, stepIndex) {
	if (flashSuccessful) {
		if (variant === 'desktop') {
			formatAndDisplaySteps(
				{
					ui,
					text: `All done! Your Tachyon device is ready to boot to the desktop and will automatically connect to Wi-Fi.${os.EOL}${os.EOL}` +
					`To continue:${os.EOL}` +
					`  - Disconnect the USB-C cable${os.EOL}` +
					`  - Connect a USB-C Hub with an HDMI monitor, keyboard, and mouse.${os.EOL}` +
					`  - Power off the device by holding the power button for 3 seconds and releasing.${os.EOL}` +
					`  - Power on the device by pressing the power button.${os.EOL}${os.EOL}` +
					`When the device boots it will:${os.EOL}` +
					`  - Activate the built-in 5G modem.${os.EOL}` +
					`  - Connect to the Particle Cloud.${os.EOL}` +
					`  - Run all system services, including the desktop if an HDMI monitor is connected.${os.EOL}${os.EOL}` +
					`For more information about Tachyon, visit our developer site at: https://developer.particle.io!${os.EOL}` +
					`${os.EOL}` +
					`View your device on the Particle Console at: ${consoleLink({ productSlug, deviceId: deviceInfo.deviceId })}`,
					step: stepIndex,
				}
				,
			);
		} else {
			formatAndDisplaySteps(
				`All done! Your Tachyon device is now booting into the operating system and will automatically connect to Wi-Fi.${os.EOL}${os.EOL}` +
				`It will also:${os.EOL}` +
				`  - Activate the built-in 5G modem${os.EOL}` +
				`  - Connect to the Particle Cloud${os.EOL}` +
				`  - Run all system services, including battery charging${os.EOL}${os.EOL}` +
				`For more information about Tachyon, visit our developer site at: https://developer.particle.io!${os.EOL}` +
				`${os.EOL}` +
				`View your device on the Particle Console at: ${consoleLink()}`,
				stepIndex
			);
		}
	} else {
		ui.write(
			`${os.EOL}Flashing failed. Please unplug your device and rerun this. We're going to have to try it again.${os.EOL}` +
			`If it continues to fail, please select a different USB port or visit https://part.cl/setup-tachyon and the setup link for more information.${os.EOL}`
		);
	}
}

function consoleLink({ productSlug, deviceId }) {
	const baseUrl = `https://console${settings.isStaging ? '.staging' : ''}.particle.io`;
	return `${baseUrl}/${productSlug}/devices/${deviceId}`;
}

async function runStepWithTiming(ui, stepDesc, stepNumber, asyncTask, minDuration = 2000) {
	formatAndDisplaySteps({ ui, text: stepDesc, step: stepNumber });

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

function formatAndDisplaySteps({ ui, text, step }) {
	// Display the formatted step
	ui.write(`${os.EOL}===================================================================================${os.EOL}`);
	if (step) {
		ui.write(`Step ${step}:${os.EOL}`);
	}
	ui.write(`${text}`);
}

module.exports = {
	pickVariant,
	downloadOS,
	printOSInfo,
	getUserConfigurationStep,
	configureProductStep,
	getCountryStep,
	registerDeviceStep,
	getESIMProfilesStep,
	setupCompletedStep
};
