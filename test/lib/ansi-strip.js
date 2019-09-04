// source: https://github.com/chalk/ansi-regex
const ptn = new RegExp(
	[
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
	].join('|'),
	'g'
);

module.exports = (str) => str.replace(ptn, '');

