const chalk = require('chalk');


module.exports.formatLibrary = (library, excludeBadges=[]) => {
	let badges = [];

	if (library.official && !excludeBadges.official) {
		badges.push(chalk.green('[official] '));
	} else {
		if (library.verified && !excludeBadges.verified) {
			badges.push(chalk.green('[verified] '));
		}
	}

	if (library.visibility==='private' && !excludeBadges.private) {
		badges.push(chalk.blue('[private] '));
	} else {
		if (library.mine && !excludeBadges.mine) {
			badges.push(chalk.blue('[mine] '));
		}
	}

	const badgesText = badges.join('');
	const version = library.version;
	const defaultSentence = '';
	const formatted = chalk.blue(library.name)+' '+version+' '+badgesText+chalk.grey(library.installs || 0)+' '+ `${library.sentence || defaultSentence}`;
	return formatted;
};

