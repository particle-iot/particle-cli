'use strict';
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const project = require('./project');


describe('Project Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		project({ root, commandProcessor });
	});

	describe('Top-Level `project` Namespace', () => {
		it('Handles `project` command', () => {
			const argv = commandProcessor.parse(root, ['project']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help', () => {
			commandProcessor.parse(root, ['project', '--help']);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Manage application projects',
					'Usage: particle project <command>',
					'Help:  particle help project <command>',
					'',
					'Commands:',
					'  create  Create a new project in the current or specified directory',
					'  ai      Add AI assistant instruction files (AGENTS.md, CLAUDE.md, copilot-instructions.md) to a project',
					''
				].join('\n'));
			});
		});
	});

	describe('Handles `project create` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['project', 'create', 'my-dir']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ dir: 'my-dir' });
			expect(argv.ai).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['project', 'create']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ dir: undefined });
			expect(argv.ai).to.equal(false);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['project', 'create', 'my-dir', '--name', 'my-project', '--ai']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ dir: 'my-dir' });
			expect(argv.name).to.equal('my-project');
			expect(argv.ai).to.equal(true);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['project', 'create', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Create a new project in the current or specified directory',
					'Usage: particle project create [options] [dir]',
					'',
					'Options:',
					'  --name  provide a name for the project  [string]',
					'  --ai    also add AI assistant instruction files to the project  [boolean]',
					''
				].join('\n'));
			});
		});
	});

	describe('Handles `project ai` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['project', 'ai', 'my-dir']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ dir: 'my-dir' });
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['project', 'ai']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ dir: undefined });
		});

		it('Includes help with examples', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['project', 'ai', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Add AI assistant instruction files (AGENTS.md, CLAUDE.md, copilot-instructions.md) to a project',
					'Usage: particle project ai [options] [dir]',
					'',
					'Examples:',
					'  particle project ai             Add AI assistant instruction files to the project in the current directory',
					'  particle project ai my_project  Add AI assistant instruction files to the project in the my_project directory',
					''
				].join('\n'));
			});
		});
	});
});
