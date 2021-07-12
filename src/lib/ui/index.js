const os = require('os');
const Chalk = require('chalk').constructor;
const Spinner = require('cli-spinner').Spinner;
const platformsById = require('../../cmd/constants').platformsById;
const settings = require('../../../settings');


module.exports = class UI {
	constructor({
		stdin = process.stdin,
		stdout = process.stdout,
		stderr = process.stderr,
		quiet = false
	} = {}){
		this.stdin = stdin;
		this.stdout = stdout;
		this.stderr = stderr;
		this.quiet = quiet;
		this.chalk = new Chalk(); // TODO (mirande): explicitly enable / disable colors
		this.EOL = os.EOL;
	}

	write(data){
		const { stdout, EOL } = this;
		stdout.write(data + EOL);
	}

	error(data){
		const { stderr, EOL } = this;
		stderr.write(data + EOL);
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

	logDeviceDetail(devices, { varsOnly = false, fnsOnly = false } = {}){
		const { EOL, chalk } = this;
		const deviceList = Array.isArray(devices) ? devices : [devices];
		const lines = [];

		for (let i = 0; i < deviceList.length; i++){
			const device = deviceList[i];
			const deviceType = platformsById[device.product_id] || `Product ${device.product_id}`;
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

