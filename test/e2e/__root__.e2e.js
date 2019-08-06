const cli = require('../__lib__/cli');
const fs = require('../__lib__/fs');
const {
	PATH_TMP_DIR
} = require('../__lib__/env');


before(async () => {
	await fs.ensureDir(PATH_TMP_DIR);
	await fs.emptyDir(PATH_TMP_DIR);
});

after(async () => {
	await cli.logout();
	await cli.setDefaultProfile();
});

afterEach(async () => {
	await fs.emptyDir(PATH_TMP_DIR);
});

