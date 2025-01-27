const { expect, sinon } = require('../../test/setup');
const DownloadManager = require('./download-manager');
const nock = require('nock');
const fs = require('fs-extra');
const path = require('path');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const UI = require('./ui');

describe('DownloadManager', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = {
			...originalEnv,
			home: PATH_TMP_DIR,
		};
	});

	afterEach(async () => {
		sinon.restore();
		process.env = originalEnv;
		await fs.remove(path.join(PATH_TMP_DIR, '.particle/downloads'));
	});

	describe('initialize', () => {
		it('creates a download manager', () => {
			const downloadManager = new DownloadManager();
			expect(downloadManager.downloadDir).to.eql(path.join(PATH_TMP_DIR,'.particle/downloads'));
			expect(fs.existsSync(downloadManager.downloadDir)).to.be.true;
		});
	});

	describe('cleanup', () => {
		it('removes the download directory', async () => {
			const downloadManager = new DownloadManager();
			await fs.mkdirp(downloadManager.downloadDir);
			expect(fs.existsSync(downloadManager.downloadDir)).to.be.true;

			await downloadManager.cleanup();
			expect(fs.existsSync(downloadManager.downloadDir)).to.be.false;
		});

		it('removes a specific file from the download directory', async () => {
			const downloadManager = new DownloadManager();
			const testFile = path.join(downloadManager.downloadDir, 'test.bin');
			await fs.ensureFile(testFile);
			expect(fs.existsSync(testFile)).to.be.true;

			await downloadManager.cleanup({ fileName: 'test.bin' });
			expect(fs.existsSync(testFile)).to.be.false;
		});

		it('removes only in-progress files', async () => {
			const downloadManager = new DownloadManager();
			const progressFile = path.join(downloadManager.downloadDir, 'test.bin.progress');
			const completedFile = path.join(downloadManager.downloadDir, 'test.bin');

			// Create both progress and completed files
			await fs.ensureFile(progressFile);
			await fs.ensureFile(completedFile);

			// Verify files exist
			expect(fs.existsSync(progressFile)).to.be.true;
			expect(fs.existsSync(completedFile)).to.be.true;

			// Remove only in-progress files
			await downloadManager.cleanup({ cleanInProgress: true, cleanDownload: false });

			// Verify the progress file is removed and the completed file remains
			expect(fs.existsSync(progressFile)).to.be.false;
			expect(fs.existsSync(completedFile)).to.be.true;
		});
	});

	describe('download', () => {
		let downloadManager;
		let ui;
		beforeEach(() => {
			ui = sinon.createStubInstance(UI, {
				write: sinon.stub(),
				error: sinon.stub(),
				createProgressBar: sinon.stub(),
				showBusySpinnerUntilResolved: sinon.stub().callsFake((text, promise) => promise),
			});
			downloadManager = new DownloadManager(ui);
		});
		it('downloads a file', async () => {
			const url = 'https://example.com';
			const outputFileName = 'file.txt';
			const fileContent = 'This is a test file.';

			// Mock the HTTP response
			nock(url)
				.get(`/${outputFileName}`)
				.reply(200, fileContent);

			const result = await downloadManager.download({ url: `${url}/${outputFileName}`, outputFileName });
			console.log(result);
			const finalFilePath = path.join(downloadManager.downloadDir, outputFileName);
			expect(fs.existsSync(finalFilePath)).to.be.true;
			const content = fs.readFileSync(finalFilePath, 'utf8');
			expect(content).to.equal(fileContent);
		});

		it('resumes a download', async () => {
			const url = 'https://example.com';
			const outputFileName = 'file.txt';
			const initialContent = 'This is a ';
			const remainingContent = 'resumed download test.';
			const tempFilePath = path.join(downloadManager.downloadDir, `${outputFileName}.progress`);

			// Create a partial file
			fs.writeFileSync(tempFilePath, initialContent);

			// Mock the HTTP response with a range
			nock(url, { reqheaders: { Range: 'bytes=10-' } })
				.get(`/${outputFileName}`)
				.reply(206, remainingContent);

			await downloadManager.download({ url: `${url}/${outputFileName}`, outputFileName });

			const finalFilePath = path.join(downloadManager.downloadDir, outputFileName);
			const content = fs.readFileSync(finalFilePath, 'utf8');
			expect(content).to.equal(initialContent + remainingContent);
		});

		it('throws an error if the download fails', async () => {
			const url = 'https://example.com';
			const outputFileName = 'file.txt';
			let error;

			// Mock the HTTP response to simulate a failure
			nock(url)
				.get(`/${outputFileName}`)
				.reply(500);

			try {
				await downloadManager.download({ url:`${url}/${outputFileName}`, outputFileName });
				throw new Error('Expected method to throw.');
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.include('Unexpected response status: 500');
		});

		it('throws an error if checksum does not match', async () => {
			const url = 'https://example.com';
			const outputFileName = 'file.txt';
			const fileContent = 'This is a test file.';
			let error;

			// Mock the HTTP response
			nock(url)
				.get(`/${outputFileName}`)
				.reply(200, fileContent);

			try {
				await downloadManager.download({ url:`${url}/${outputFileName}`, outputFileName, expectedChecksum: 'invalidchecksum' });
			} catch (_error) {
				error = _error;
			}
			const tempPath = path.join(downloadManager.downloadDir, `${outputFileName}.progress`);
			const finalPath = path.join(downloadManager.downloadDir, `${outputFileName}`);
			expect(error.message).to.include('Checksum validation failed for file.txt');
			expect(fs.existsSync(tempPath)).to.be.false;
			expect(fs.existsSync(finalPath)).to.be.false;
		});
		it('validates checksum and save the file', async () => {
			const url = 'https://example.com';
			const outputFileName = 'file.txt';
			const fileContent = 'This is a test file.';
			const checksum = 'f29bc64a9d3732b4b9035125fdb3285f5b6455778edca72414671e0ca3b2e0de';

			// Mock the HTTP response
			nock(url)
				.get(`/${outputFileName}`)
				.reply(200, fileContent);

			await downloadManager.download({ url: `${url}/${outputFileName}`, outputFileName, expectedChecksum: checksum });

			const tempFilePath = path.join(downloadManager.downloadDir, `${outputFileName}.progress`);
			const finalFilePath = path.join(downloadManager.downloadDir, outputFileName);
			expect(fs.existsSync(finalFilePath)).to.be.true;
			expect(fs.existsSync(tempFilePath)).to.be.false;
			const content = fs.readFileSync(finalFilePath, 'utf8');
			expect(content).to.equal(fileContent);
		});
	});

});
