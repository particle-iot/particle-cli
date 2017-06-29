import {expect} from '../test-setup';

const utilities = require('../../oldlib/utilities');

describe('utilities', () => {
	describe('globList', () => {
		it('imports globList successfully', () => {
			expect(utilities.globList).to.be.ok;
		});
	});
});
