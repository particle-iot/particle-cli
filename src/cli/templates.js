import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import chalklib from 'chalk';

Handlebars.registerHelper({
	lookup(hash, key) {
		return hash[key];
	},
	chalk(color, strength, options) {
		return chalklib[color][strength](options.fn(this));
	},
	defaultValue(val, defaultVal) {
		return val || defaultVal;
	},
	printIf(val, trueVal, falseVal) {
		return val ? trueVal : falseVal;
	}
});

const deviceList = Handlebars.compile(fs.readFileSync(path.join(__dirname, '../../templates/deviceList.hbs')).toString());

export {
	deviceList
};
