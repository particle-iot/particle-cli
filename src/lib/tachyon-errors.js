class QDLError extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

class DownloadError extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

module.exports = {
	QDLError,
	DownloadError
};

