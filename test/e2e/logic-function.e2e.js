const { expect } = require('../setup');
const cli = require('../lib/cli');
const fs = require('fs-extra');
const { PATH_TMP_DIR, PATH_FIXTURES_LOGIC_FUNCTIONS } = require('../lib/env');
const path = require('path');

describe('Logic Function Commands', () => {
	let id;

	const help = [
		'Create, execute, and deploy Logic Functions',
		'Usage: particle logic-function <command>',
		'Help:  particle help logic-function <command>',
		'',
		'Commands:',
		'  list     Lists the deployed Logic Functions',
		'  get      Downloads the Logic Function',
		'  create   Creates a Logic Function',
		'  execute  Executes a Logic Function with user provided data',
		'  deploy   Deploys a Logic Function to the cloud',
		'  disable  Disables a Logic Function in the cloud',
		'  enable   Enables a Logic Function in the cloud',
		'  delete   Deletes a Logic Function from the cloud',
		'  logs     Shows logs from a Logic Function',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		''
	];

	const listOutput = [
		'No Logic Functions deployed in cyberdyne-systems.',
		'',
		'To create a Logic Function, see particle logic-function create.',
		'To download an existing Logic Function, see particle logic-function get.'
	];

	const createOutput = [
		'',
		'Creating Logic Function newLF for cyberdyne-systems...',
		'',
		`Successfully created newLF locally in ${PATH_TMP_DIR}`,
		'',
		'Files created:',
		'- newlf.js',
		'- newlf.logic.json',
		'',
		'Guidelines for creating your Logic Function can be found here https://docs.particle.io/getting-started/cloud/logic/',
		'Once you have written your Logic Function, run',
		'- particle logic-function execute to run your Function',
		'- particle logic-function deploy to deploy your new changes',
		''
	];

	const executeOutput = [
		'',
		'Execution Status: Success',
		'Logs from Execution:',
		'',
		'No errors during Execution.'
	];

	const deployOutput = [
		'',
		'Execution Status: Success',
		'Logs from Execution:',
		'',
		'No errors during Execution.',
		'',
		'',
		// 'Deploying Logic Function lf3 to for cyberdyne-systems...',
		// 'Success! Logic Function name deployed with ID: bbd75c65-0db2-44bd-9d35-8ce6db9885e3',
		'',
		'Visit console.particle.io to view results from your device(s)!',
	];

	const getOutput = [
		'Downloaded:',
		' - newlf.logic.json',
		' - newlf.js',
		'',
		'Note that any local modifications to these files need to be deployed to the cloud in order to take effect.',
		'Refer to particle logic-function execute and particle logic-function deploy for more information.'
	];

	before(async () => {
		await cli.setDefaultProfile();
		await cli.login();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
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
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'list', '--quiet', '--org', 'cyberdyne-systems']);
		// FIXME: This would pass even if listOutput was empty
		expect(stdout.split('\n')).to.include.members(listOutput);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Creates a blank Logic Function locally', async () => {
		await fs.remove(path.join(PATH_TMP_DIR, 'newlf'));

		const { stdout, stderr, exitCode } = await cli.run(['lf', 'create', '--quiet', '--name', 'newLF', '--org', 'cyberdyne-systems', '--force'], { cwd: PATH_TMP_DIR });

		expect(stdout.split('\n')).to.include.members(createOutput);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Executes a Logic Function', async () => {
		await fs.copy(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj', 'config.json'), path.join(PATH_TMP_DIR, 'newlf', 'newlf.logic.json'));
		await fs.copy(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj', 'code.js'), path.join(PATH_TMP_DIR, 'newlf', 'newlf.js'));

		const { stdout, stderr, exitCode } = await cli.run(['lf', 'execute', '--quiet', '--org', 'cyberdyne-systems', '--data', '1234'], { cwd: path.join(PATH_TMP_DIR, 'newlf') });

		expect(stdout.split('\n')).to.include.members(executeOutput);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Deploys a new Logic Function', async () => {
		await fs.copy(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj', 'config.json'), path.join(PATH_TMP_DIR, 'newlf', 'newlf.logic.json'));
		await fs.copy(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj', 'code.js'), path.join(PATH_TMP_DIR, 'newlf', 'newlf.js'));

		const { stdout, stderr, exitCode } = await cli.run(['lf', 'deploy', '--quiet', '--org', 'cyberdyne-systems', '--data', '1234', '--force'], { cwd: path.join(PATH_TMP_DIR, 'newlf') });

		stdout.split('\n').forEach((line) => {
			if (line.includes('Deploying Logic Function')) {
				id = line.substring(line.indexOf('(') + 1, line.indexOf(')'));
			}
		});

		expect(stdout.split('\n')).to.include.members(deployOutput);
		expect(stdout).to.contain('Success');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Re-deploys a Logic Function', async () => {
		if (!fs.existsSync(path.join(PATH_TMP_DIR, 'newlf', 'newlf.js'))) {
			await fs.copy(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj', 'config.json'), path.join(PATH_TMP_DIR, 'newlf', 'newlf.logic.json'));
			await fs.copy(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf3_proj', 'code.js'), path.join(PATH_TMP_DIR, 'newlf', 'newlf.js'));
		}
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'deploy', '--quiet', '--org', 'cyberdyne-systems', '--data', '1234', '--force'], { cwd: path.join(PATH_TMP_DIR, 'newlf') });

		stdout.split('\n').forEach((line) => {
			if (line.includes('deployed to')) {
				id = line.substring(line.indexOf('(') + 1, line.indexOf(')'));
			}
		});

		expect(stdout.split('\n')).to.include.members(deployOutput);
		expect(stdout).to.contain('Success');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Disables a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'disable', '--quiet', '--org', 'cyberdyne-systems', '--id', id]);
		expect(stdout).to.equal(`Logic Function newlf (${id}) is now disabled.`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Enables a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'enable', '--quiet', '--org', 'cyberdyne-systems', '--id', id]);

		expect(stdout).to.equal(`Logic Function newlf (${id}) is now enabled.`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Downloads a Logic Function', async () => {
		await fs.remove(path.join(PATH_TMP_DIR, 'newlf'));

		const { stdout, stderr, exitCode } = await cli.run(['lf', 'get', '--quiet', '--id', id, '--org', 'cyberdyne-systems'], { cwd: PATH_TMP_DIR });

		expect(stdout.split('\n')).to.include.members(getOutput);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		await fs.remove(path.join(PATH_TMP_DIR, 'newlf.js'));
		await fs.remove(path.join(PATH_TMP_DIR, 'newlf.logic.json'));
	});

	it('Deletes a Logic Function', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['lf', 'delete', '--quiet', '--org', 'cyberdyne-systems', '--id', id, '--force']);

		expect(stdout).to.contain('has been successfully deleted.');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

