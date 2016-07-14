
import {expect, td} from '../test-setup';

import {LibraryAddCommand} from '../../src/lib/library';
import {CLILibraryAddCommandSite} from '../../src/cmd/library';
const projectProperties = td.replace('../../src/lib/ProjectProperties');

describe('LibraryAddCommand', () => {
	describe("the project properties doesn't exist", () => {
		it('prompts to create the project', async () => {
			const testSite = td.object(CLILibraryAddCommandSite);

			td.when(projectProperties.exists()).thenReturn(Promise.resolve(false));

			const sut = new LibraryAddCommand();
			await sut.run(testSite, 'neopixel');


		});
	});
});