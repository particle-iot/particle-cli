
import {expect} from '../test-setup';
import ProjectProperties, {legacy, simple, extended} from "../../src/lib/project_properties";
const fs = require('fs');
const mockfs = require('mock-fs');
const promisify = require('es6-promisify');

describe('project properties', () => {

	const sut = new ProjectProperties('.', { fs: {
		statAsync: (...args) => promisify(fs.stat)(...args),
		writeFileAsync: (...args) => promisify(fs.writeFile)(...args),
		readFileAsync: (...args) => promisify(fs.readFile)(...args)
	}});

	beforeEach((done) => {
		mockfs({});
		done();
	});
	afterEach((done) => {
		mockfs.restore();
		done();
	});

	describe('exists', () => {

		it('returns false when the file does not exist', () => {
			return expect(sut.exists()).to.eventually.be.false;
		});

		it('returns true when the file does exist', () => {
			fs.writeFileSync('project.properties', '');
			return expect(sut.exists()).to.eventually.be.true;
		});

	});

	describe('source exists', () => {
		it('returns false when the src directory does not exist', () => {
			return expect(sut.sourceDirExists()).to.eventually.be.false;
		});

		it('returns true when the src directory exists', () => {
			fs.mkdirSync('src');
			return expect(sut.sourceDirExists()).to.eventually.be.true;
		});
	});

	describe('project layout', () => {
		it('recongizes a legacy project', () => {
			return expect(sut.projectLayout()).to.be.eventually.equal(legacy);
		});

		it('recongizes a simple project', () => {
			fs.writeFileSync('project.properties', '');
			return expect(sut.projectLayout()).to.be.eventually.equal(simple);
		});

		it('recongizes an extended project', () => {
			fs.writeFileSync('project.properties', '');
			fs.mkdirSync('src');
			return expect(sut.projectLayout()).to.eventually.be.equal(extended);
		});
	});
});