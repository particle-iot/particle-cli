const wiringPreprocessor = require('wiring-preprocessor');
const path = require('path');
const fs = require('fs');

const STANDARD_STREAM = '-';

class PreprocessCommand {
	constructor({ stdin = process.stdin, stdout = process.stdout } = {}) {
		this.stdin = stdin;
		this.stdout = stdout;
	}

	preprocess(file, { saveTo, name } = {}) {
		const inoFilename = this.getInoFilename(file, name);
		const inputStream = this.getInputStream(file);
		const outputStream = this.getOutputStream(saveTo || this.outputFilename(file));

		return this.readTransformWrite(inputStream, outputStream, (content) => {
			return wiringPreprocessor.processFile(inoFilename, content);
		});
	}

	getInoFilename(file, name) {
		if (name) {
			return name;
		}
		if (file === STANDARD_STREAM) {
			return 'stdin';
		}
		return file;
	}

	getInputStream(file) {
		if (file === STANDARD_STREAM) {
			return this.stdin;
		}
		return fs.createReadStream(file);
	}

	getOutputStream(file) {
		if (file === STANDARD_STREAM) {
			return this.stdout;
		}
		return fs.createWriteStream(file);
	}

	outputFilename(file) {
		if (file === STANDARD_STREAM) {
			return STANDARD_STREAM;
		}

		const parsed = path.parse(file);
		parsed.base = parsed.name + '.cpp';
		return path.format(parsed);
	}

	readTransformWrite(inputStream, outputStream, transform) {
		return new Promise((fulfill, reject) => {
			const chunks = [];
			inputStream.on('readable', () => {
				try {
					let data;
					// eslint-disable-next-line no-cond-assign
					while (data = inputStream.read()) {
						chunks.push(data.toString('utf8'));
					}
				} catch (error) {
					reject(error);
				}
			});

			inputStream.on('end', () => {
				try {
					const content = chunks.join('');
					const transformed = transform(content);
					outputStream.end(transformed);
				} catch (error) {
					reject(error);
				}
			});

			inputStream.on('error', reject);
			outputStream.on('error', reject);
			outputStream.on('finish', fulfill);
		});
	}
}

module.exports = PreprocessCommand;
