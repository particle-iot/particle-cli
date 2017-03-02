
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
var when = require('when');


var firmware_version = '0.6.1';

describe('the update firmware binaries are all valid', function() {

	var updateDir = path.resolve(__dirname, '..', 'updates');
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

	for (var updateFiles = getUpdateFiles(), i=0; i<updateFiles.length; i++) {
		var updateFile = path.join(updateDir, updateFiles[i]);
		(function (updateFile, fileName) {
			describe('binary file '+fileName, function() {
				it('is non-zero in size', function() {
					expect(getFilesizeInBytes(updateFile)).to.be.greaterThan(0);
				});

				it('has a valid crc ', function() {
					var dfd = when.defer();
					var parser = new Parser();
					parser.parseFile(updateFile, function parsed(fileInfo, err) {
						if (err) {
							return dfd.reject(err);
						}

						if (fileInfo.suffixInfo.suffixSize === 65535) {
							return dfd.reject(binaryFile + ' does not contain inspection information');
						}

						if (!fileInfo.crc.ok) {
							dfd.reject('CRC failed (should be '
								+ (fileInfo.crc.storedCrc) + ' but is '
								+ (fileInfo.crc.actualCrc) + ')');
						}
						dfd.resolve();
					}.bind(this));
					return dfd.promise;
				});
			});
		})(updateFile, updateFiles[i]);

	}
});