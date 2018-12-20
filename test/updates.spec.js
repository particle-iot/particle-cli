
var sinon = require('sinon');

var chai = require('chai');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(sinonChai);
chai.use(chaiAsPromised);
var expect = chai.expect;
var fs = require('fs');
var path = require('path');
var Parser = require('binary-version-reader').HalModuleParser;
var Buffer = require('safe-buffer').Buffer;
var when = require('when');


describe('the update firmware binaries are all valid', function() {

	var updateDir = path.resolve(__dirname, '../assets/updates');
	var binaryExtension = '.bin';

	function getUpdateFiles() {
		return fs.readdirSync(updateDir);
	}

	function getFilesizeInBytes(filename) {
		var stats = fs.statSync(filename);
		var fileSizeInBytes = stats.size;
		return fileSizeInBytes;
	}

	it('has update files', function () {
		expect(getUpdateFiles()).to.have.property('length').greaterThan(0);
	});

	describe('update files validity check', function () {
		for (var updateFiles = getUpdateFiles(), i=0; i<updateFiles.length; i++) {
			var updateFile = path.join(updateDir, updateFiles[i]);
			(function (updateFile, fileName) {
				describe('binary file '+fileName, function() {
					it('is non-zero in size', function() {
						expect(getFilesizeInBytes(updateFile)).to.be.greaterThan(0);
					});

					it('has a valid crc ', function() {
						var parser = new Parser();
						return parser.parseFile(updateFile).then(fileInfo => {
							if (fileInfo.suffixInfo.suffixSize === 65535) {
								throw new Error(binaryFile + ' does not contain inspection information');
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
