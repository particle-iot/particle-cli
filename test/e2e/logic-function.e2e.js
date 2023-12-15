const { expect } = require('../setup');
const cli = require('../lib/cli');
const fs = require('fs-extra');
const { PATH_TMP_DIR, USERNAME, PATH_FIXTURES_LOGIC_FUNCTIONS } = require('../lib/env');
const path = require('path');
const { delay } = require('../lib/mocha-utils');
const os = require('os');

describe('Logic Function Commands', () => {
	let id;

	const help = [
		'Create, execute, and deploy logic functions',
		'Usage: particle logic-function <command>',
		'Help:  particle help logic-function <command>',
		'',
		'Commands:',
		'  list     Lists the deployed logic functions',
		'  get      Downloads the logic function',
		'  create   Creates a logic function',
		'  execute  Executes a logic function with user provided data',
		'  deploy   Deploys a logic function to the cloud',
		'  disable  Disables a logic function in the cloud',
		'  enable   Enables a logic function in the cloud',
		'  delete   Deletes a logic function from the cloud',
		'  logs     Shows logs from a Logic Function',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		''
	];

	const listOutput = [
		'Logic Functions deployed in your Sandbox:',
		'- MyLF (enabled)',
		'	- ID: 0021e8f4-64ee-416d-83f3-898aa909fb1b',
		'	- Event based trigger'
	];

	const getOutput = [
		'Downloaded:',
		' - mylf.logic.json',
		' - mylf.js',
		'',
		'Note that any local modifications to these files need to be deployed to the cloud in order to take effect.',
		'Refer to particle logic-function execute and particle logic-function deploy for more information.'
	];

	const createOutput = [
		'Creating Logic Function newLF for your Sandbox...',
		'',
		'Successfully created newLF locally in .',
		'',
		'Files created:',
		'- newlf/@types/particle_core.d.ts',
		'- newlf/@types/particle_encoding.d.ts',
		'- newlf/newlf.js',
		'- newlf/newlf.logic.json',
		'',
		'Guidelines for creating your Logic Function can be found here <TBD>.',
		'Once you have written your Logic Function, run',
		'- \'particle logic-function execute\' to run your Function',
		'- \'particle logic-function deploy\' to deploy your new changes',
	];

	const executeOutput = [
		'Executing Logic Function code.js for your Sandbox...',
		'',
		'Execution Status: Success',
		'Logs from Execution:',
		'',
		'No errors during Execution.'
	];

	const deployOutput = [
		'Executing Logic Function code.js for your Sandbox...',
		'',
		'Execution Status: Success',
		'Logs from Execution:',
		'',
		'No errors during Execution.',
		'',
		'',
		// 'Deploying Logic Function lf3 to your Sandbox...',
		// 'Success! Logic Function name deployed with ID: bbd75c65-0db2-44bd-9d35-8ce6db9885e3',
		'',
		'Visit \'console.particle.io\' to view results from your device(s)!',
	];

	before(async () => {
		await cli.setDefaultProfile();
		await cli.login();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
		await fs.remove(path.join(PATH_TMP_DIR, 'mylf.js'));
		await fs.remove(path.join(PATH_TMP_DIR, 'mylf.logic.json'));
		// FIXME
		await fs.remove(path.join(process.cwd(), 'a'));
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'logic-function']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content with alias', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'lf']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['logic-function', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Lists Logic Functions', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'list']);

		// FIXME: This would pass even if listOutput was empty
		expect(stdout.split('\n')).to.include.members(listOutput);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Downloads a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'get', '--name', 'MyLF']);

		expect(stdout.split('\n')).to.include.members(getOutput);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await fs.remove(path.join(PATH_TMP_DIR, 'mylf.js'));
		await fs.remove(path.join(PATH_TMP_DIR, 'mylf.logic.json'));
	});

	it('Creates a blank Logic Function locally', async () => {
		// remove if exists
		await fs.remove(path.join(PATH_TMP_DIR, 'newlf'));

		const { stdout, stderr, exitCode } = await cli.run(['lf', 'create', '--name', 'newLF', '--force']);

		expect(stdout.split('\n')).to.include.members(createOutput);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Executes a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'execute', '--data', '1234', path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj')]);

		expect(stdout.split('\n')).to.include.members(executeOutput);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Deploys a new Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'deploy', '--data', '1234', path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj'), '--force']);

		stdout.split('\n').forEach((line) => {
			if (line.includes('Success!')) {
				id = line.split('ID: ')[1];
			}
		});

		expect(stdout.split('\n')).to.include.members(deployOutput);
		expect(stdout).to.contain('Success');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Re-deploys a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'deploy', '--data', '1234', path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj'), '--force']);

		expect(stdout.split('\n')).to.include.members(deployOutput);
		expect(stdout).to.contain('Success');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Disables a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'disable', '--id', id]);

		expect(stdout).to.equal(`Logic Function lf3 (${id}) is now disabled.`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Enables a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'enable', '--id', id]);

		expect(stdout).to.equal(`Logic Function lf3 (${id}) is now enabled.`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Deletes a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'delete', '--id', id, '--force']);

		expect(stdout).to.contain('has been successfully deleted.');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

