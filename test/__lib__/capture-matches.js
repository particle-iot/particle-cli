module.exports = (str, regex) => {
	let output = [];
	let matches;

	while ((matches = regex.exec(str))){
		output.push(matches[1]);
	}

	return output;
};

