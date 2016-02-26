import help from './help';
import cloud from './cloud';
import keys from './keys';
import event from './event';
import alias from './alias';

export default (app, cli) => {
	// help must come first
	help(app, cli);
	cloud(app, cli);
	keys(app, cli);
	event(app, cli);
	alias(app, cli);
};
