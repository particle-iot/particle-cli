
module.exports = {

	formatItems: function(items, formatter, lines) {
		items.forEach(function (item, index, array) {
			var output = formatter(item, index, array);
			if (Array.isArray(output)) {
				lines.push.apply(lines, output);
			} else {
				lines.push(output);
			}
			return lines;
		});
	},

	stringFormatter: function(item) {
		return ''+item;
	},

	print: function(lines) {
		console.log(lines.join('\n'));
	}

};