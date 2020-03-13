const semver = require('semver');
const pkgJSON = require('../../package.json');
const { expect } = require('../setup');
const cli = require('../lib/cli');


describe('Version Commands', () => {
	it('Prints the version', async () => {
		const { stdout, stderr, exitCode } = await cli.run('version');

		expect(stdout).to.equal(pkgJSON.version);
		expect(!!semver.valid(stdout)).to.equal(true);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});

	it('Prints the version when run with `--version` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run('--version');

		expect(stdout).to.equal(pkgJSON.version);
		expect(!!semver.valid(stdout)).to.equal(true);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

