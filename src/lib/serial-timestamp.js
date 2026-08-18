'use strict';
const moment = require('moment');

/**
 * Formats a date as an ISO 8601 timestamp with milliseconds.
 * @param {Date} date Date to format
 * @param {Boolean} utc When true, format in UTC (2026-08-17T18:04:40.805Z) instead of
 *   local time (2026-08-17T14:04:40.805-04:00)
 * @returns {String} formatted timestamp
 */
function formatTimestamp(date, utc){
	if (utc){
		return date.toISOString();
	}
	return moment(date).format('YYYY-MM-DDTHH:mm:ss.SSSZ');
}

/**
 * Creates a function that writes text, prepending a timestamp to the start of each line.
 *
 * Text is written through as soon as it is received, so a line that hasn't been terminated
 * yet is not held back. The timestamp reflects the time the text was received, not the time
 * the line was completed.
 *
 * @param {Object} options Options
 * @param {Function} options.write Called with the text to output
 * @param {Boolean} options.utc Use UTC timestamps instead of local time
 * @param {Function} options.now Returns the current date, for testing
 * @returns {Function} function accepting the text to write
 */
function createTimestampWriter({ write, utc = false, now = () => new Date() }){
	let atLineStart = true;

	return (text) => {
		if (!text){
			return;
		}

		const prefix = `${formatTimestamp(now(), utc)} `;
		const lines = text.split('\n');
		let output = '';

		lines.forEach((line, index) => {
			const isLastLine = index === lines.length - 1;
			// Don't start a line just because the text ended with a newline, wait for
			// the next chunk so the timestamp matches when the line was received
			if (atLineStart && !(isLastLine && line === '')){
				output += prefix;
				atLineStart = false;
			}
			output += line;
			if (!isLastLine){
				output += '\n';
				atLineStart = true;
			}
		});

		write(output);
	};
}

module.exports = {
	formatTimestamp,
	createTimestampWriter
};
