
import {expect, sinon} from '../test-setup';
import {LibrarySearchCommand} from '../../src/cmd/library_search';

describe('LibrarySearchCommand', () => {
	it('handles api errors', () => {
		const sut = new LibrarySearchCommand();
		const apiError = new Error();

		const convertedError = sut.apiError(apiError);

		expect(convertedError).to.be.ok;
	});

	it('run calls listLibraries', () => {
		const sut = new LibrarySearchCommand();
		const state = {};
		const filter = 'filter';
		const site = {
			searchString: sinon.stub().returns(filter)
		};
		sut.listLibraries = sinon.stub().resolves(123);

		const execute = () => sut.run(state, site);

		const verify = (result) => {
			expect(site.searchString).to.be.calledOnce;
			expect(sut.listLibraries).to.be.calledWith(site, filter);
			expect(result).to.equal(123);
		};

		return execute().then(verify);
	});

	it('converts an API error when the client fails to list a library', () => {
		const sut = new LibrarySearchCommand();
		const filter = '';
		const client = {
			libraries: sinon.stub().rejects(new Error('API error'))
		};
		const site = {
			apiClient: sinon.stub().returns(client),
			notifyListLibrariesStart: (promise) => promise,
			notifyListLibrariesComplete: sinon.stub()
		};

		const execute = () => sut.listLibraries(site, filter);

		const verify = () => {
			throw new Error('expected rejection');
		};
		const verifyReject = (error) => {
			expect(error).to.match(/API error/);
			expect(site.notifyListLibrariesComplete).to.be.calledOnce;
		}

		return execute().then(verify, verifyReject);
	});

	it('returns libraries from the API', () => {
		const sut = new LibrarySearchCommand();
		const filter = '';
		const libraries = [];
		const client = {
			libraries: sinon.stub().resolves(libraries)
		};
		const site = {
			apiClient: sinon.stub().returns(client),
			notifyListLibrariesStart: (promise) => promise,
			notifyListLibrariesComplete: sinon.stub()
		};

		const execute = () => sut.listLibraries(site, filter);

		const verify = (result) => {
			expect(result).to.equal(libraries);
			expect(site.notifyListLibrariesComplete).to.be.calledOnce;
		};

		return execute().then(verify);
	});
});
