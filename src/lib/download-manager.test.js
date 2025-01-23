const { expect, sinon } = require('../../test/setup');
const DownloadManager = require('./download-manager');
const nock = require('nock');
const fs = require('fs-extra');
const path = require('path');
const { PATH_TMP_DIR } = require('../../test/lib/env');

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
		await fs.remove(path.join(PATH_TMP_DIR, '.particle/channels/test'));
	});

	describe('initialize', () => {
		it('creates a download manager', () => {
			const channel = {
				name: 'test',
				url: 'http://example.com'
			};
			const downloadManager = new DownloadManager(channel);
			expect(downloadManager.channel).to.eql(channel);
			expect(downloadManager.tempDir).to.eql(path.join(PATH_TMP_DIR, '.particle/channels/test/tmp'));
			expect(downloadManager.downloadDir).to.eql(path.join(PATH_TMP_DIR,'.particle/channels/test/downloads'));
			expect(fs.existsSync(downloadManager.tempDir)).to.be.true;
			expect(fs.existsSync(downloadManager.downloadDir)).to.be.true;
		});

		it('throws an error if channel is not provided', () => {
			expect(() => new DownloadManager()).to.throw('Channel is required');
		});
	});

	describe('cleanup', () => {
		it('removes the download directory', async () => {
			const channel = {
				name: 'test',
				url: 'http://example.com'
			};
			const downloadManager = new DownloadManager(channel);
			await downloadManager.cleanup();
			expect(fs.existsSync(downloadManager.tempDir)).to.be.false;
			expect(fs.existsSync(downloadManager.downloadDir)).to.be.false;
		});

		it('removes a specific file from the download directory', async () => {
			const channel = {
				name: 'test',
				url: 'http://example.com'
			};
			const downloadManager = new DownloadManager(channel);
			const testFile = path.join(downloadManager.downloadDir, 'test.bin');
			await fs.ensureFile(testFile);
			expect(fs.existsSync(testFile)).to.be.true;
			await downloadManager.cleanup({ fileName: 'test.bin' });
			expect(fs.existsSync(testFile)).to.be.false;
		});

		it('removes only the temp directory when specified', async () => {
			const channel = {
				name: 'test',
				url: 'http://example.com'
			};
			const downloadManager = new DownloadManager(channel);
			await downloadManager.cleanup({ cleanTemp: true, cleanDownload: false });
			expect(fs.existsSync(downloadManager.tempDir)).to.be.false;
			expect(fs.existsSync(downloadManager.downloadDir)).to.be.true;
		});

		it('removes only the download directory when specified', async () => {
			const channel = {
				name: 'test',
				url: 'http://example.com'
			};
			const downloadManager = new DownloadManager(channel);
			await downloadManager.cleanup({ cleanTemp: false, cleanDownload: true });
			expect(fs.existsSync(downloadManager.tempDir)).to.be.true;
			expect(fs.existsSync(downloadManager.downloadDir)).to.be.false;
		});
	});

	describe('_downloadFile', () => {
		let downloadManager;
		const channel = {
			name: 'test',
			url: 'https://example.com'
		};
		beforeEach(() => {

			downloadManager = new DownloadManager(channel);
		});
		it('downloads a file', async () => {
			const fileUrl = 'file.txt';
			const outputFileName = 'file.txt';
			const fileContent = 'This is a test file.';

			// Mock the HTTP response
			nock(channel.url)
				.get(`/${fileUrl}`)
				.reply(200, fileContent);

			await downloadManager._downloadFile(fileUrl, outputFileName);

			const finalFilePath = path.join(downloadManager.downloadDir, outputFileName);
			expect(fs.existsSync(finalFilePath)).to.be.true;
			const content = fs.readFileSync(finalFilePath, 'utf8');
			expect(content).to.equal(fileContent);
		});

		it('resumes a download', async () => {
			const fileUrl = 'file.txt';
			const outputFileName = 'file.txt';
			const initialContent = 'This is a ';
			const remainingContent = 'resumed download test.';
			const tempFilePath = path.join(downloadManager.tempDir, outputFileName);

			// Create a partial file
			fs.writeFileSync(tempFilePath, initialContent);

			// Mock the HTTP response with a range
			nock(channel.url, { reqheaders: { Range: 'bytes=10-' } })
				.get(`/${fileUrl}`)
				.reply(206, remainingContent);

			await downloadManager._downloadFile(fileUrl, outputFileName);

			const finalFilePath = path.join(downloadManager.downloadDir, outputFileName);
			const content = fs.readFileSync(finalFilePath, 'utf8');
			expect(content).to.equal(initialContent + remainingContent);
		});

		it('caches a downloaded file', async () => {
			const fileUrl = 'file.txt';
			const outputFileName = 'file.txt';

			// Stub the cache method to simulate a cached file
			const cachedFilePath = path.join(downloadManager.downloadDir, outputFileName);
			fs.writeFileSync(cachedFilePath, 'Cached file content.');
			const cacheStub = sinon.stub(downloadManager, 'getCachedFile').resolves(cachedFilePath);

			const result = await downloadManager._downloadFile(fileUrl, outputFileName);

			expect(result).to.equal(cachedFilePath);
			expect(cacheStub.calledOnce).to.be.true;

			cacheStub.restore();
		});

		it('throws an error if the download fails', async () => {
			const fileUrl = 'file.txt';
			const outputFileName = 'file.txt';

			// Mock the HTTP response to simulate a failure
			nock(channel.url)
				.get(`/${fileUrl}`)
				.reply(500);

			try {
				await downloadManager._downloadFile(fileUrl, outputFileName);
				throw new Error('Expected method to throw.');
			} catch (error) {
				expect(error.message).to.include('Unexpected response status: 500');
			}
		});
	});

});
