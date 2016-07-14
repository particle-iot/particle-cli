import tmp from 'tmp';
import fs from 'fs-extra';
import path from 'path';

export default function getProjectFixture(name) {
	const sourceDir = path.join(__dirname, name);
	if (!fs.existsSync(sourceDir)) {
		throw `Project fixture ${name} doesn't exist`;
	}
	const destDir = tmp.dirSync().name;

	fs.copySync(sourceDir, destDir);

	return destDir;
}