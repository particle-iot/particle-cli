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
	describe('help secrets', () => {
		const help = [
			'create, update, list and remove secrets',
			'Usage: particle secrets <command>',
			'Help:  particle help secrets <command>',
			'',
			'Commands:',
			'  list    List all created secrets.',
			'          Alias: this command can be also executed as sc list[options]',
			'  get     Get an specific secret',
			'  create  Creates a new secret',
			'  update  Updates the value of an existing secret',
			'  remove  Remove an specific secret',
			'',
			'Global Options:',
			'  -v, --verbose  Increases how much logging to display  [count]',
			'  -q, --quiet    Decreases how much logging to display  [count]',
			''
		];
		it('Shows `help` content', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['help', 'secrets']);
			expect(stdout).to.equal('');
			expect(stderr.split('\n')).to.include.members(help);
			expect(exitCode).to.equal(0);
		});

		it('Shows `help` content with alias', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['help', 'sc']);

			expect(stdout).to.equal('');
			expect(stderr.split('\n')).to.include.members(help);
			expect(exitCode).to.equal(0);
		});

		it('Shows `help` content when run with `--help` flag', async () => {
			const { stdout, stderr, exitCode } = await cli.run(['secrets', '--help']);
			expect(stdout).to.equal('');
			expect(stderr.split('\n')).to.include.members(help);
			expect(exitCode).to.equal(0);
		});
	});

	describe('secrets flow (create, get, update, list, delete)', () => {
		it('creates a new secret for org', async () => {
			const { stdout, stderr, exitCode } = await cli.run([
				'secrets', 'create',
				'--name', secretName,
				'--value', 'value',
				'--org', orgName]);
			const expectedOutput = `Secret ${secretName} created successfully.`;
			expect(stdout).to.include(expectedOutput);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
		it('lists the secret', async () => {
			const { stdout, stderr, exitCode } = await cli.run([
				'secrets', 'list',
				'--org', orgName
			]);
			expect(stdout).to.include(secretName);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('updates the secret', async () => {
			const { stdout, stderr, exitCode } = await cli.run([
				'secrets', 'update',
				'--name', secretName,
				'--value', 'updated_value',
				'--org', orgName
			]);
			expect(stdout).to.include(`Secret ${secretName} updated successfully.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('remove the secret', async () => {
			const { stdout, stderr, exitCode } = await cli.run([
				'secrets', 'remove',
				'--name', secretName,
				'--org', orgName
			]);
			expect(stdout).to.include(`Secret ${secretName} removed successfully.`);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});
});

