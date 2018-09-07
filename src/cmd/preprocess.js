const wiringPreprocessor = require('wiring-preprocessor');
const path = require('path');
const fs = require('fs');

const STANDARD_STREAM = '-';

class PreprocessCommand {
	constructor({ preprocessor = wiringPreprocessor, stdin = process.stdin, stdout = process.stdout } = {}) {
		this.preprocessor = preprocessor;
		this.stdin = stdin;
		this.stdout = stdout;
	}

	preprocess(file, { saveTo } = {}) {
		return new Promise((fulfill, reject) => {
			saveTo = saveTo || this.outputFilename(file);

			const inputFilename = file === STANDARD_STREAM ? 'stdin' : file;
			const inputStream = file === STANDARD_STREAM ? this.stdin : fs.createReadStream(file);
			const outputStream = saveTo === STANDARD_STREAM ? this.stdout : fs.createWriteStream(saveTo);

			const chunks = [];
			inputStream.on('readable', () => {
				try {
					chunks.push(inputStream.read().toString('utf8'));
				} catch (error) {
					reject(error);
				}
			});

			inputStream.on('end', () => {
				try {
					const content = chunks.join();

					const processed = this.preprocessor.processFile(inputFilename, content);
					outputStream.end(processed);
				} catch (error) {
					reject(error);
				}
			});

			inputStream.on('error', reject);
			outputStream.on('error', reject);
			outputStream.on('finish', fulfill);
		});
	}

	outputFilename(file) {
		if (file === STANDARD_STREAM) {
			return STANDARD_STREAM;
		}

		const parsed = path.parse(file);
		parsed.ext = '.cpp';
		delete parsed.base;
		return path.format(parsed);
	}
}

module.exports = PreprocessCommand;
