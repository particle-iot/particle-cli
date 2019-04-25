
var defaultSpinnerString = 0;
var defaultSpinnerDelay = 60;

function Spinner(textToShow){
	this.text = textToShow || '';
	this.setSpinnerString(defaultSpinnerString);
	this.setSpinnerDelay(defaultSpinnerDelay);
	this.running = false;
}

Spinner.spinners = [
	'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'
];

Spinner.setDefaultSpinnerString = (value) => {
	defaultSpinnerString = value;
};

Spinner.setDefaultSpinnerDelay = (value) => {
	defaultSpinnerDelay = value;
};

Spinner.prototype.start = function start() {
	this.running = true;
};

Spinner.prototype.setSpinnerDelay = function setSpinnerDelay(n) {
	this.delay = n;
};

Spinner.prototype.setSpinnerString = function setSpinnerString(str) {
	this.chars = mapToSpinner(str, this.spinners).split('');
};

Spinner.prototype.stop = function stop() {
	this.running = false;
};

// Helpers

function isInt(value) {
	return (typeof value==='number' && (value%1)===0);
}

function mapToSpinner(value) {
	// Not an integer, return as strng
	if (!isInt(value)) {
		return value + '';
	}

	// Check if index is within bounds
	value = (value >= Spinner.spinners.length) ? 0 : value;
	// If negative, count from the end
	value = (value < 0) ? Spinner.spinners.length + value : value;

	return Spinner.spinners[value];
}

exports.Spinner = Spinner;
