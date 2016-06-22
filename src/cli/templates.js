import Handlebars from 'handlebars';
import '../templates';
import chalklib from 'chalk';
import momentjs from 'moment';

Handlebars.registerHelper({
	lookup(hash, key) {
		return hash[key];
	},
	chalk(color, strength, options) {
		return chalklib[color][strength](options.fn(this));
	},
	defaultValue(val, defaultVal) {
		return new Handlebars.SafeString(val || defaultVal);
	},
	printIf(val, trueVal, falseVal) {
		return new Handlebars.SafeString(val ? trueVal : falseVal);
	},
	moment(date, format) {
		return new Handlebars.SafeString(momentjs(date).format(format));
	},
	tab() {
		return new Handlebars.SafeString('\t');
	}
});
