import {expect} from '../test-setup';
import fs from 'fs';
import ProjectProperties from '../../src/lib/ProjectProperties';
import getProjectFixture from '../fixtures/projects';

describe('ProjectProperties', () => {
	describe('exists', () => {
		it('returns true when project properties exists', async () => {
			const dir = getProjectFixture('simple');
			const sut = new ProjectProperties(dir);
			expect(await sut.exists()).to.equal(true);
		})

		it("returns false when project properties doesn't exist", async () => {
			const dir = getProjectFixture('blank');
			const sut = new ProjectProperties(dir);
			expect(await sut.exists()).to.equal(false);
		})
	})

	describe('load', () => {
		it('load the fields', async () => {
				const dir = getProjectFixture('simple');
				const sut = new ProjectProperties(dir);

				await sut.load();
				const expectedProperties = JSON.parse(fs.readFileSync(`${dir}/expectedProperties.json`));
				expect(sut.fields).to.eql(expectedProperties);
			})
		})

	describe('save', () => {
		it('saves the same content', async () => {
			const dir = getProjectFixture('simple');
			const sut = new ProjectProperties(dir);

			const originalProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');

			await sut.load();
			await sut.save();

			const savedProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');
			expect(savedProperties).to.equal(originalProperties);
		})

		it('saves new content', async () => {
			const dir = getProjectFixture('blank');
			const sut = new ProjectProperties(dir);

			sut.fields['name'] = 'my project';
			sut.fields['dependencies.assettracker'] = '1.0.0';
			await sut.save();

			const savedProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');
			const expectedProperties = "name=my project\ndependencies.assettracker=1.0.0";
			expect(savedProperties).to.equal(expectedProperties);
		})
	})
})