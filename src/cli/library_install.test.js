'use strict';
const { expect } = require('../../test/setup');
const { LibraryInstallCommand } = require('../cmd');
const libraryCommands = require('./library');
const commandProcessor = require('../app/command-processor');
const { CLILibraryInstallCommandSite } = require('./library_install');


describe('library install command', () => {
	describe('site', () => {
		const sut = new CLILibraryInstallCommandSite({});
		it('can instantiate the site', () => {
			return expect(sut).to.be.ok;
		});
	});

	describe('command', () => {
		const sut = new LibraryInstallCommand();

		it('can instantiate the command', () => {
			return expect(sut).to.be.ok;
		});
	});

	describe('command line', () => {
		let lib;
		beforeEach(() => {
			const root = commandProcessor.createAppCategory();
			lib = libraryCommands({ commandProcessor, root });
		});

		it('recognizes the install command', () => {
			const argv = lib.parse('library install'.split(' '));
			expect(argv.clicommand).to.be.ok;
		});

		it('recognizes the install command with library', () => {
			const argv = lib.parse('library install neopixel'.split(' '));
			expect(argv.clicommand).to.be.ok;
			expect(argv.params).to.be.deep.equal({ name:'neopixel' });
		});

		it('recognizes the install vendored command', () => {
			const argv = lib.parse('library install --vendored'.split(' '));
			expect(argv.clicommand).to.be.ok;
			expect(argv).to.have.property('vendored').that.is.true;
		});

		it('recognizes the install vendored command with confirmation', () => {
			const argv = lib.parse('library install --vendored -y'.split(' '));
			expect(argv.clicommand).to.be.ok;
			expect(argv).to.have.property('vendored').that.is.true;
			expect(argv).to.have.property('confirm').that.is.true;
		});

		it('recognizes the install vendored command with library', () => {
			const argv = lib.parse('library install neopixel --vendored'.split(' '));
			expect(argv.clicommand).to.be.ok;
			expect(argv).to.have.property('vendored').that.is.true;
			expect(argv.params).to.be.deep.equal({ name:'neopixel' });
		});

		it('recognizes the install vendored command with library name at end', () => {
			const argv = lib.parse('library install --vendored neopixel'.split(' '));
			expect(argv.clicommand).to.be.ok;
			expect(argv).to.have.property('vendored').that.is.true;
			expect(argv.params).to.be.deep.equal({ name:'neopixel' });
		});
	});
});

