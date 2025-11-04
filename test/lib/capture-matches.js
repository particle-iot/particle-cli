'use strict';
module.exports = (str, regex) => {
	const output = [];
	let matches;

	while ((matches = regex.exec(str))){
		output.push(matches[1]);
	}

	return output;
};

