'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('../../test/setup');
const { editAsync } = require('external-editor');

// inquirer's `editor` prompt (used by `particle serial wifi` and
// `particle wireless` to enter certificates) opens the user's editor on a
// temporary file through external-editor, which creates it with `tmp`.
describe('external editor (inquirer editor prompt)', () => {
	const ENV_VARS = ['VISUAL', 'EDITOR'];
	const savedEnv = {};
	let scriptDir;

	beforeEach(() => {
		for (const name of ENV_VARS) {
			savedEnv[name] = process.env[name];
			delete process.env[name];
		}
		scriptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-editor-'));
		// A cross-platform "editor": appends a line and records which file it edited
		const script = path.join(scriptDir, 'editor.js');
		fs.writeFileSync(script, [
			'const fs = require(\'fs\');',
			'const file = process.argv[2];',
			`fs.writeFileSync(${JSON.stringify(path.join(scriptDir, 'edited-path'))}, file);`,
			'fs.appendFileSync(file, \'\\n-----END CERTIFICATE-----\');'
		].join('\n'));
		const node = process.execPath.includes(' ') ? `"${process.execPath}"` : process.execPath;
		process.env.EDITOR = `${node} ${script}`;
	});

	afterEach(() => {
		for (const name of ENV_VARS) {
			if (savedEnv[name] === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = savedEnv[name];
			}
		}
		fs.rmSync(scriptDir, { recursive: true, force: true });
	});

	it('returns the text written by the editor and removes the temporary file', async () => {
		const text = await new Promise((resolve, reject) => {
			editAsync('-----BEGIN CERTIFICATE-----', (error, result) => error ? reject(error) : resolve(result));
		});

		expect(text).to.equal('-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----');
		const editedPath = fs.readFileSync(path.join(scriptDir, 'edited-path'), 'utf8');
		expect(fs.realpathSync(path.dirname(editedPath))).to.equal(fs.realpathSync(os.tmpdir()));
		expect(fs.existsSync(editedPath)).to.equal(false);
	});
});
