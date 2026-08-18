'use strict';
const { expect } = require('../../test/setup');
const { formatTimestamp, createTimestampWriter } = require('./serial-timestamp');

describe('serial-timestamp', () => {
	describe('formatTimestamp', () => {
		it('formats a date in UTC', () => {
			const date = new Date('2026-08-17T18:04:40.805Z');
			expect(formatTimestamp(date, true)).to.equal('2026-08-17T18:04:40.805Z');
		});

		it('formats a date in local time with the UTC offset', () => {
			const date = new Date('2026-08-17T18:04:40.805Z');
			expect(formatTimestamp(date, false)).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$/);
		});
	});

	describe('createTimestampWriter', () => {
		let output;
		let dates;

		const writer = ({ utc = true } = {}) => createTimestampWriter({
			write: (text) => output.push(text),
			utc,
			now: () => dates.shift()
		});

		beforeEach(() => {
			output = [];
			dates = [
				new Date('2026-08-17T18:04:40.805Z'),
				new Date('2026-08-17T18:04:41.900Z'),
				new Date('2026-08-17T18:04:42.100Z')
			];
		});

		it('prepends a timestamp to a single line', () => {
			writer()('hello\n');
			expect(output.join('')).to.equal('2026-08-17T18:04:40.805Z hello\n');
		});

		it('prepends a timestamp to each line of a chunk', () => {
			writer()('one\ntwo\n');
			expect(output.join('')).to.equal(
				'2026-08-17T18:04:40.805Z one\n2026-08-17T18:04:40.805Z two\n'
			);
		});

		it('timestamps blank lines', () => {
			writer()('one\n\n');
			expect(output.join('')).to.equal(
				'2026-08-17T18:04:40.805Z one\n2026-08-17T18:04:40.805Z \n'
			);
		});

		it('writes an unterminated line right away and does not timestamp its continuation', () => {
			const write = writer();
			write('par');
			write('tial\n');
			expect(output).to.eql(['2026-08-17T18:04:40.805Z par', 'tial\n']);
		});

		it('timestamps the next line with the time it was received', () => {
			const write = writer();
			write('one\n');
			write('two\n');
			expect(output).to.eql([
				'2026-08-17T18:04:40.805Z one\n',
				'2026-08-17T18:04:41.900Z two\n'
			]);
		});

		it('keeps carriage returns intact', () => {
			writer()('one\r\ntwo\r\n');
			expect(output.join('')).to.equal(
				'2026-08-17T18:04:40.805Z one\r\n2026-08-17T18:04:40.805Z two\r\n'
			);
		});

		it('ignores empty text', () => {
			writer()('');
			expect(output).to.eql([]);
		});
	});
});
