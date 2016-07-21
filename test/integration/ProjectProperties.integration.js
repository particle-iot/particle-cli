import {expect} from '../test-setup';
import fs from 'fs';
import ProjectProperties from '../../src/lib/ProjectProperties';
import getProjectFixture from '../fixtures/projects';

describe('ProjectProperties', () => {
	describe('exists', () => {
		it('returns true when project properties exists', () => {
			const dir = getProjectFixture('simple');
			const sut = new ProjectProperties(dir);
			return sut.exists().then(result => {
				expect(result).to.be.true;
			})
		})

		it("returns false when project properties doesn't exist", () => {
			const dir = getProjectFixture('blank');
			const sut = new ProjectProperties(dir);
			return sut.exists().then(result => {
				expect(result).to.be.false;
			})
		})
	})

	describe('load', () => {
		it('load the fields', () => {
			const dir = getProjectFixture('simple');
			const sut = new ProjectProperties(dir);

			return sut.load().then(() => {
				const expectedProperties = JSON.parse(fs.readFileSync(`${dir}/expectedProperties.json`));
				expect(sut.fields).to.eql(expectedProperties);
			})
		})
	})

	describe('save', () => {
		it('saves the same content',  () => {
			const dir = getProjectFixture('simple');
			const sut = new ProjectProperties(dir);
			const propsFile = `${dir}/project.properties`;

			const originalProperties = fs.readFileSync(propsFile, 'utf8');

			return sut.load().then(() => {
				fs.unlinkSync(propsFile);
				return sut.save();
			}).then(() => {
				const savedProperties = fs.readFileSync(propsFile, 'utf8');
				expect(savedProperties).to.equal(originalProperties);
			})
		})

		it('saves new content', () => {
			const dir = getProjectFixture('blank');
			const sut = new ProjectProperties(dir);

			Object.assign(sut.fields, {
				name: 'my project',
				'dependencies.assettracker': '1.0.0'
			});

			return sut.save().then(() => {
				const savedProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');
				const expectedProperties = "name=my project\ndependencies.assettracker=1.0.0\n";
				expect(savedProperties).to.equal(expectedProperties);
			})
		})
	})
})