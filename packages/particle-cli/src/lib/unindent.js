module.exports = function unindent(string) {
	const match = string.match(/\n(\s*)/m);
	if (!match) {
		return string;
	}

	const re = new RegExp(`^${match[1]}`, 'gm');
	return string.replace(re, '').replace(/^\n/, '').replace(/\n[ \t]*$/, '');
};

