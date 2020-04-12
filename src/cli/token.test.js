const os = require('os');
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const token = require('./token');


describe('Token Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		token({ root, commandProcessor });
	});

	describe('Top-Level `token` Namespace', () => {
		it('Handles `token` command', () => {
			const argv = commandProcessor.parse(root, ['token']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['token', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Manage access tokens (require username/password)',
					'Usage: particle token <command>',
					'Help:  particle help token <command>',
					'',
					'Commands:',
					'  list    List all access tokens for your account',
					'  revoke  Revoke an access token',
					'  create  Create a new access token',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`token list` Namespace', () => {
		it('Handles `list` command', () => {
			const argv = commandProcessor.parse(root, ['token', 'list']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['token', 'list', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'List all access tokens for your account',
					'Usage: particle token list [options]',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`token revoke` Namespace', () => {
		it('Handles `revoke` command', () => {
			const argv = commandProcessor.parse(root, ['token', 'revoke', '1234']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ tokens: ['1234'] });
			expect(argv.force).to.equal(false);
		});

		it('Errors when required `deviceID` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['token', 'revoke']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'tokens\' must have at least one item.');
			expect(argv.clierror).to.have.property('data', 'tokens');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
			expect(argv.force).to.equal(false);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['token', 'revoke', '1234', '--force']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ tokens: ['1234'] });
			expect(argv.force).to.equal(true);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['token', 'revoke', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Revoke an access token',
					'Usage: particle token revoke [options] <tokens...>',
					'',
					'Options:',
					'  --force  Force deleting access token used by this CLI  [boolean]',
					'',
					'Examples:',
					'  particle token revoke 1234          Revoke your access token `1234`',
					'  particle token revoke 1234 5678     Revoke your access tokens `1234` and `5678`',
					'  particle token revoke 1234 --force  Revoke your access token `1234` even if it is currently used by this CLI',
					'  particle token revoke all           Revoke all of your access tokens',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`token create` Namespace', () => {
		it('Handles `create` command', () => {
			const argv = commandProcessor.parse(root, ['token', 'create']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv['expires-in']).to.equal(undefined);
			expect(argv['never-expires']).to.equal(false);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['token', 'create', '--expires-in', '60', '--never-expires']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv['expires-in']).to.equal(60);
			expect(argv['never-expires']).to.equal(true);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['token', 'create', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Create a new access token',
					'Usage: particle token create [options]',
					'',
					'Options:',
					'  --expires-in     Create a token valid for this many seconds. When omitted, the Particle API assigns a default expiration.  [number]',
					'  --never-expires  Create a token that doesn\'t expire. Useful for a token that will be used by a cloud application for making Particle API requests.  [boolean]',
					''
				].join(os.EOL));
			});
		});
	});
});

