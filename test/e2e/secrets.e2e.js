'use strict';
const { expect } = require('chai');
const cli = require('../lib/cli');


function generateUppercaseUnderscoreWord(partCount = 3, partLength = 3) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

	const getWordPart = (allowStartingDigit = true) => {
		let part = '';
		for (let i = 0; i < partLength; i++) {
			if (i === 0 && !allowStartingDigit) {
				part += letters.charAt(Math.floor(Math.random() * letters.length));
			} else {
				part += chars.charAt(Math.floor(Math.random() * chars.length));
			}
		}
		return part;
	};

	const parts = [];
	for (let i = 0; i < partCount; i++) {
		parts.push(getWordPart(i !== 0)); // disallow digit at start only in the first part
	}

	return parts.join('_');
}

describe('Secrets', () => {
	const secretName = generateUppercaseUnderscoreWord();
	const orgName = 'cyberdyne-systems';

	before(async () => {
		await cli.setDefaultProfile();
		await cli.login();
	});
	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});
	describe('help config secret', () => {
		const help = [
			'Manage secrets',
			'Usage: particle config secrets <command>',
			'Help:  particle help config secrets <command>',
			'',
			'Commands:',
			'  list    List all created secrets',
			'  get     Get a specific secret',
			'  set     Set a secret',
			'  delete  Delete a specific secret',
			'',
			'Global Options:',
			'  -v, --verbose  Increases how much logging to display  [count]',
			'  -q, --quiet    Decreases how much logging to display  [count]',
			'',
			'Options:',
			'  --sandbox  Target the sandbox  [boolean]',
			'  --org      Specify the organization  [string]',
			''
		];
		it('Shows `help` content', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['help', 'config', 'secrets']);
			expect(stdout).to.equal('');
			expect(stderr.split('\n')).to.include.members(help);
			expect(exitCode).to.equal(0);
		});

		it('Shows `help` content when run with `--help` flag', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['config', 'secrets', '--help']);
			expect(stdout).to.equal('');
			expect(stderr.split('\n')).to.include.members(help);
			expect(exitCode).to.equal(0);
		});
	});

	describe('config secret flow (set, get, list, delete)', () => {
		it('sets a new secret for org', async () => {
			const { stdout, stderr, exitCode } = await cli.run([
				'config', 'secrets', 'set',
				secretName, 'value',
				'--org', orgName]);
			const expectedOutput = `Secret ${secretName} set successfully.`;
			expect(stdout).to.include(expectedOutput);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
		it('lists the secret', async () => {
			const { stdout, stderr, exitCode } = await cli.run([
				'config', 'secrets', 'list',
				'--org', orgName
			]);
			expect(stdout).to.include(secretName);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('updates the secret', async () => {
			const { stdout, stderr, exitCode } = await cli.run([
				'config', 'secrets', 'set',
				secretName, 'updated_value',
				'--org', orgName
			]);
			expect(stdout).to.include(`Secret ${secretName} set successfully.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('delete the secret', async () => {
			const { stdout, stderr, exitCode } = await cli.run([
				'config', 'secrets', 'delete',
				secretName,
				'--org', orgName
			]);
			expect(stdout).to.include(`Secret ${secretName} deleted successfully.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});
});

