const path = require('path');
const fs = require('fs-extra');
const { PATH_PARTICLE_PROFILE } = require('./env');


module.exports = Object.assign({}, fs); // TODO (mirande): better approach?

module.exports.getDirectoryContents = async (dir, options = {}, contents = [], rootDepth) => {
	const { getDirectoryContents, readdir, stat } = module.exports;
	const { maxDepth } = options;
	const files = await readdir(dir);

	rootDepth = rootDepth || dir.split(path.sep).length;

	for (let file of files) {
		const filepath = path.join(dir, file);
		const stats = await stat(filepath);

		contents.push(filepath);

		if (stats.isDirectory()){
			const depth = filepath.split(path.sep).length - rootDepth;

			if (depth <= maxDepth){
				contents = await getDirectoryContents(filepath, options, contents, rootDepth);
			}
		}
	}

	return contents;
};

module.exports.getParticleAccessToken = async () => {
	const { readFile } = module.exports;
	const json = await readFile(PATH_PARTICLE_PROFILE, 'utf8');
	const { access_token: token } = JSON.parse(json);
	return token;
};

