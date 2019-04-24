var chai = require('chai');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(sinonChai);
chai.use(chaiAsPromised);
var expect = chai.expect;
var fs = require('fs');
var path = require('path');
var Parser = require('binary-version-reader').HalModuleParser;


describe('the update firmware binaries are all valid', () => {
	var updateDir = path.resolve(__dirname, '../assets/updates');

	function getUpdateFiles() {
		return fs.readdirSync(updateDir);
	}

	function getFilesizeInBytes(filename) {
		var stats = fs.statSync(filename);
		var fileSizeInBytes = stats.size;
		return fileSizeInBytes;
	}

	it('has update files', () => {
		expect(getUpdateFiles()).to.have.property('length').greaterThan(0);
	});

	describe('update files validity check', () => {
		for (var updateFiles = getUpdateFiles(), i=0; i<updateFiles.length; i++) {
			var updateFile = path.join(updateDir, updateFiles[i]);
			((updateFile, fileName) => {
				describe('binary file '+fileName, () => {
					it('is non-zero in size', () => {
						expect(getFilesizeInBytes(updateFile)).to.be.greaterThan(0);
					});

					it('has a valid crc ', () => {
						var parser = new Parser();
						return parser.parseFile(updateFile).then(fileInfo => {
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
			})(updateFile, updateFiles[i]);
		}
	});
});
