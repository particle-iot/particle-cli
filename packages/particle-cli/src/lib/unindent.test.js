const { expect } = require('../../test/setup');
const unindent = require('./unindent');


describe('unindent', () => {
	it('does not change a single line string', () => {
		const string = '   foo';
		expect(unindent(string)).to.equal(string);
	});

	it('removes leading and trailing newlines', () => {
		const string = `
foo
`;
		expect(unindent(string)).to.equal('foo');
	});
	it('removes leading tabs', () => {
		const string = `
			foo
		`;
		expect(unindent(string)).to.equal('foo');
	});
	it('removes leading spaces', () => {
		const string = `
            foo
		`;
		expect(unindent(string)).to.equal('foo');
	});
	it('removes the same amount of indent from every line', () => {
		const string = `
			foo
				bar
			fred
		`;
		expect(unindent(string)).to.equal('foo\n	bar\nfred');
	});
});

