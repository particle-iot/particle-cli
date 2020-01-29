const os = require('os');
const Chalk = require('chalk').constructor;
const platformsById = require('../../cmd/constants').platformsById;


module.exports = class UI {
	constructor({
		stdin = process.stdin,
		stdout = process.stdout,
		stderr = process.stderr
	} = {}){
		this.stdin = stdin;
		this.stdout = stdout;
		this.stderr = stderr;
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

	logProductDetail(products){
		const { EOL, chalk } = this;
		const productList = Array.isArray(products) ? products : [products];
		const lines = [];

		for (const product of productList){
			const deviceType = platformsById[product.platform_id] || 'Unknown';
			lines.push(`${chalk.cyan.bold(product.name)} [${product.id}] (${deviceType})`);

			if (product.description){
				lines.push('  Description:');
				lines.push(`    ${product.description}`);
			}

			if (product.organization){
				lines.push('  Organization:');
				lines.push(`    ${product.organization}`);
			}

			if (product.groups && product.groups.length){
				lines.push('  Groups:');
				lines.push(`    ${product.groups.join(`${os.EOL}    `)}`);
			}
		}

		this.write(lines.join(EOL));
	}

	logDeviceDetail(devices){
		const { EOL, chalk } = this;
		const deviceList = Array.isArray(devices) ? devices : [devices];
		const lines = [];

		for (let i = 0; i < deviceList.length; i++){
			const device = deviceList[i];
			const deviceType = platformsById[device.product_id] || `Product ${device.product_id}`;
			const connected = device.connected;
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
			formatVariables(device.variables, lines);
			formatFunctions(device.functions, lines);
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

