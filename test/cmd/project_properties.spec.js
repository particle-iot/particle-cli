
import {expect} from '../test-setup';
import ProjectProperties, {legacy, simple, extended} from "../../src/cmd/project_properties";
const fs = require('fs');
const mockfs = require('mock-fs');
const promisify = require('es6-promisify');

describe('project properties', () => {

	const sut = new ProjectProperties('.', { fs: {
		stat: (...args) => promisify(fs.stat)(...args),
		writeFile: (...args) => promisify(fs.writeFile)(...args),
		readFile: (...args) => promisify(fs.readFile)(...args)
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

	describe('properties', () => {
		it('strips spaces from properties and values', () => {
			sut.parse(
			`
			a = 1
			b = 2
			`);
			expect(sut.fields.a).is.equal('1');
			expect(sut.fields.b).is.equal('2');
		});
	});

	describe('groupped properties', () => {

		it('groups properties with the same dotted prefix', () => {
			sut.parse(`
			value.1=one
			value.2=two
			`);
			expect(sut.groups['value']).to.be.deep.equal({1:'one', 2:'two'});
		});

		it('groups multiple nested properties with the same dotted prefix', () => {
			sut.parse(`
			foo.value.1 = one
			foo.  value.  2=two
			foo. bar=baz
			`);
			expect(sut.groups.foo.value).to.have.property('1').equal('one');
			expect(sut.groups.foo.value).to.have.property('2').equal('two');
			expect(sut.groups.foo).to.have.property('bar').equal('baz');
		});

	});
});
