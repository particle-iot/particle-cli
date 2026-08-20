'use strict';
const fs = require('fs-extra');
const path = require('path');
const { expect, sinon } = require('../../test/setup');
const ProjectAICommand = require('./project-ai');
const { PATH_TMP_DIR } = require('../../test/lib/env');

describe('ProjectAICommand', () => {
	let projectAICommand;
	let projectDir;

	beforeEach(async () => {
		projectAICommand = new ProjectAICommand();
		projectAICommand.ui = {
			stdout: {
				write: sinon.stub()
			},
			stderr: {
				write: sinon.stub()
			}
		};
		projectDir = path.join(PATH_TMP_DIR, 'project-ai-test');
		await fs.ensureDir(projectDir);
	});

	afterEach(async () => {
		sinon.restore();
		fs.emptyDirSync(PATH_TMP_DIR);
	});

	describe('addAIFiles', () => {
		it('creates the AI instruction files in a fresh project', async () => {
			await fs.writeFile(path.join(projectDir, 'project.properties'), 'name=my-project');

			await projectAICommand.addAIFiles({ dir: projectDir });

			const agents = await fs.readFile(path.join(projectDir, 'AGENTS.md'), 'utf8');
			const claude = await fs.readFile(path.join(projectDir, 'CLAUDE.md'), 'utf8');
			const copilot = await fs.readFile(path.join(projectDir, '.github', 'copilot-instructions.md'), 'utf8');
			expect(agents).to.include('# Particle Firmware Project Instructions');
			expect(claude).to.include('Read `AGENTS.md`');
			expect(copilot).to.include('Read `AGENTS.md`');
			const output = projectAICommand.ui.stdout.write.getCalls().map((call) => call.args[0]).join('');
			expect(output).to.include('Created AGENTS.md');
			expect(output).to.include('Created CLAUDE.md');
			expect(output).to.include(`Created ${path.join('.github', 'copilot-instructions.md')}`);
		});

		it('skips files that already exist without overwriting them', async () => {
			await fs.writeFile(path.join(projectDir, 'project.properties'), 'name=my-project');
			const existingContent = '# My custom agent instructions';
			await fs.writeFile(path.join(projectDir, 'AGENTS.md'), existingContent);

			await projectAICommand.addAIFiles({ dir: projectDir });

			const agents = await fs.readFile(path.join(projectDir, 'AGENTS.md'), 'utf8');
			expect(agents).to.eql(existingContent);
			expect(await fs.pathExists(path.join(projectDir, 'CLAUDE.md'))).to.be.true;
			expect(await fs.pathExists(path.join(projectDir, '.github', 'copilot-instructions.md'))).to.be.true;
			const output = projectAICommand.ui.stdout.write.getCalls().map((call) => call.args[0]).join('');
			expect(output).to.include('Skipped AGENTS.md (already exists)');
			expect(output).to.include('Created CLAUDE.md');
		});

		it('rejects when the directory is not a Particle project', async () => {
			let error;
			try {
				await projectAICommand.addAIFiles({ dir: projectDir });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.eql(`${projectDir} is not a Particle project directory (no project.properties found)`);
			expect(await fs.pathExists(path.join(projectDir, 'AGENTS.md'))).to.be.false;
		});
	});
});
