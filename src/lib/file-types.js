const sourcePatterns = [
	'**/*.h',
	'**/*.hpp',
	'**/*.hh',
	'**/*.hxx',
	'**/*.ino',
	'**/*.cpp',
	'**/*.c',
	'**/build.mk',
	'project.properties'
];

const binaryExtensions = [
	'.bin',
	'.zip'
];

const binaryPatterns = binaryExtensions.map(ext => `*${ext}`);

module.exports = {
	sourcePatterns,
	binaryExtensions,
	binaryPatterns
};
