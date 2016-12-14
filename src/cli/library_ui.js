import {spin} from '../app/ui';
import log from '../app/log';
import chalk from 'chalk';

export function formatLibrary(library, excludeBadges=[]) {
	let badges = [];

	if (library.verified && !excludeBadges.verified) {
		badges.push(chalk.green('[verified] '));
	}

	let privateBadge = false;
	if (library.visibility==='private' && !excludeBadges.private) {
		badges.push(chalk.blue('[private] '));
		privateBadge = true;
	}

	// at present, a library that is private is implicitly mine
	if (library.mine && !privateBadge && !excludeBadges.mine) {
		badges.push(chalk.blue('[mine] '));
	}

	const badgesText = badges.join('');
	const version = library.version;
	const defaultSentence = '';
	const formatted = chalk.blue(library.name)+' '+version+' '+badgesText+chalk.grey(library.installs || 0)+' '+ `${library.sentence || defaultSentence}`;
	return formatted;
}