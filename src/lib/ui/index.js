const os = require('os');
const Chalk = require('chalk').constructor;
const Spinner = require('cli-spinner').Spinner;
const { platformForId, isKnownPlatformId } = require('../platform');
const settings = require('../../../settings');
const inquirer = require('inquirer');
const cliProgress = require('cli-progress');

module.exports = class UI {
	constructor({
		stdin = process.stdin,
		stdout = process.stdout,
		stderr = process.stderr,
		quiet = false,
		isInteractive = global.isInteractive
	} = {}){
		this.stdin = stdin;
		this.stdout = stdout;
		this.stderr = stderr;
		this.quiet = quiet;
		this.chalk = new Chalk(); // TODO (mirande): explicitly enable / disable colors
		this.EOL = os.EOL;
		this.isInteractive = isInteractive;
	}

	write(data){
		const { stdout, EOL } = this;
		stdout.write(data + EOL);
	}

	error(data){
		const { stderr, EOL } = this;
		stderr.write(data + EOL);
	}

	async prompt(question, { nonInteractiveError } = {}) {
		if (!global.isInteractive){
			throw new Error(nonInteractiveError || 'Prompts are not allowed in non-interactive mode');
		}
		return inquirer.prompt(question);
	}

	async promptPasswordWithConfirmation({ customMessage, customConfirmationMessage } = {}) {
		let unmatchedPassword = true;
		let password;
		const questions = [{
			type: 'password',
			name: 'requestedPassword',
			message: customMessage || 'Enter your password:'
		},
		{
			type: 'password',
			name: 'confirmPassword',
			message: customConfirmationMessage || 'Confirm your password:'
		}];
		while (unmatchedPassword) {
			const { requestedPassword, confirmPassword } = await this.prompt(questions);
			// Verify that the passwords match
			if (requestedPassword !== confirmPassword) {
				this.write('Passwords do not match. Please try again.');
			} else {
				password = requestedPassword;
				unmatchedPassword = false;
			}
		}
		return password;
	}

	createProgressBar() {
		return new cliProgress.SingleBar({
			format: '[{bar}] {percentage}% | {description}',
			barsize: 25
		}, cliProgress.Presets.shades_classic);
	}

	showBusySpinnerUntilResolved(text, promise){
		if (this.quiet){
			return promise;
		}

		const spinner = new Spinner({ text, stream: this.stdout });
		const clear = true;

		spinner.start();

		return promise
			.then(value => {
				spinner.stop(clear);
				return value;
			})
			.catch(error => {
				spinner.stop(clear);
				throw error;
			});
	}

	logFirstTimeFlashWarning(){
		if (settings.flashWarningShownOn){
			return;
		}
		this.write(':::: NOTICE:');
		this.write(':::: Your first flash may take up to 10m to complete - during');
		this.write(':::: this time, your device may regularly change LED states');
		this.write(':::: as Device OS upgrades are applied.');
		settings.override(settings.profile, 'flashWarningShownOn', Date.now());
	}

	logDFUModeRequired({ showVersionWarning } = {}) {
		this.write(`${this.chalk.red('!!!')} The device needs to be in DFU mode for this command.\n`);
		if (showVersionWarning ) {
			this.write(`${this.chalk.cyan('>')} This version of Device OS doesn't support automatically switching to DFU mode.`);
		}
		this.write(`${this.chalk.cyan('>')} To put your device in DFU manually, please:\n`);
		this.write([
			this.chalk.bold.white('1)'),
			'Press and hold both the',
			this.chalk.bold.cyan('RESET'),
			'and',
			this.chalk.bold.cyan('MODE/SETUP'),
			'buttons simultaneously.\n'
		].join(' '));
		this.write([
			this.chalk.bold.white('2)'),
			'Release only the',
			this.chalk.bold.cyan('RESET'),
			'button while continuing to hold the',
			this.chalk.bold.cyan('MODE/SETUP'),
			'button.\n'
		].join(' '));
		this.write([
			this.chalk.bold.white('3)'),
			'Release the',
			this.chalk.bold.cyan('MODE/SETUP'),
			'button once the device begins to blink yellow.\n'
		].join(' '));
	}

	logNormalModeRequired() {
		this.write(`${this.chalk.red('!!!')} The device needs to be in Normal mode for this command.\n`);
		this.write(`${this.chalk.cyan('>')} To put your device in Normal mode manually, please:\n`);
		this.write([
			'Press the',
			this.chalk.bold.cyan('RESET'),
			'button and Release it'
		].join(' '));
	}

	logDeviceDetail(devices, { varsOnly = false, fnsOnly = false } = {}){
		const { EOL, chalk } = this;
		const deviceList = Array.isArray(devices) ? devices : [devices];
		const lines = [];

		for (let i = 0; i < deviceList.length; i++){
			const device = deviceList[i];
			const deviceType = isKnownPlatformId(device.product_id) ? platformForId(device.product_id).displayName :
				`Product ${device.product_id}`;
			const connected = device.connected || device.online;
			const connectedState = connected ? 'online' : 'offline';
			let name;

			if (!device.name || device.name === 'null'){
				name = '<no name>';
			} else {
				name = device.name;
			}

			if (connected){
				name = chalk.cyan.bold(name);
			} else {
				name = chalk.cyan.dim(name);
			}

			const status = `${name} [${device.id}] (${deviceType}) is ${connectedState}`;
			lines.push(status);

			if (!fnsOnly){
				formatVariables(device.variables, lines);
			}

			if (!varsOnly){
				formatFunctions(device.functions, lines);
			}
		}

		this.write(lines.join(EOL));

		function formatVariables(vars, lines){
			if (vars){
				const arr = [];

				for (const key in vars){
					const type = vars[key];
					arr.push(`    ${key} (${type})`);
				}

				if (arr.length > 0){
					lines.push('  Variables:');
					for (let i = 0; i < arr.length; i++){
						lines.push(arr[i]);
					}
				}
			}
		}

		function formatFunctions(funcs, lines){
			if (funcs && (funcs.length > 0)){
				lines.push('  Functions:');

				for (let idx = 0; idx < funcs.length; idx++){
					const name = funcs[idx];
					lines.push(`    int ${name} (String args) `);
				}
			}
		}
	}
};

