var fs = require('fs');
var path = require('path');
const { expect } = require('../setup');
var Parser = require('binary-version-reader').HalModuleParser;


describe('the update firmware binaries are all valid', () => {
	var updateDir = path.resolve(__dirname, '../../assets/updates');

	it('has update files', () => {
		expect(getUpdateFiles(updateDir)).to.have.property('length').greaterThan(0);
	});

	describe('update files validity check', () => {
		const updateFiles = getUpdateFiles(updateDir);

		updateFiles.forEach(file => {
			const filename = path.join(updateDir, file);

			describe(`binary file: ${file}`, () => {
				it('is non-zero in size', () => {
					const size = getFilesizeInBytes(filename);
					expect(size).to.be.greaterThan(0);
				});

				it('has a valid crc ', () => {
					if (filename.endsWith('ota-flag-a5.bin') && getFilesizeInBytes(filename) === 1) {
						return 0; // this special file is valid
					}
					return new Parser().parseFile(filename).then(fileInfo => {
						if (fileInfo.suffixInfo.suffixSize === 65535) {
							throw new Error(fileInfo.filename + ' does not contain inspection information');
						}

						if (!fileInfo.crc.ok) {
							throw new Error('CRC failed (should be '
								+ (fileInfo.crc.storedCrc) + ' but is '
								+ (fileInfo.crc.actualCrc) + ')');
						}
					});
				});
			});
		});
	});

	function getUpdateFiles(dir){
		const files = fs.readdirSync(dir);

		if (!files || !files.length){
			throw new Error(`Could not load update files from: ${dir}`);
		}

		return files.filter(f => f.endsWith('.bin'));
	}

	function getFilesizeInBytes(filename){
		var stats = fs.statSync(filename);
		var fileSizeInBytes = stats.size;
		return fileSizeInBytes;
	}
});

