module.exports = {
	formatItems(items, formatter, lines) {
		items.forEach((item, index, array) => {
			let output = formatter(item, index, array);
			if (Array.isArray(output)) {
				lines.push.apply(lines, output);
			} else {
				lines.push(output);
			}
			return lines;
		});
	},

	stringFormatter(item) {
		return ''+item;
	},

	print(lines) {
		console.log(lines.join('\n'));
	}
};

