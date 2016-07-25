
import {expect, sinon} from '../test-setup';
import {LibraryInstallCommand} from "../../src/cmd/library_install";





describe('library install', () => {

	it("installs all dependencies when no library is present", () => {
		const sut = new LibraryInstallCommand();
		const site = new LibraryInstallCommandSite();
		
		site.accessToken()
		
	});

});