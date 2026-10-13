'use strict';

const COMPILERS = ['cloud', 'local'];
const DEFAULT_COMPILER = 'cloud';

// `--compiler` selects where the source code is compiled. Shared by every command
// that compiles (`compile`, `cloud flash`, `flash`). Exposed as a factory so each
// command gets its own object and yargs never mutates a shared one.
const compilerOption = () => ({
	'compiler': {
		description: 'Where to compile the source code. local uses the toolchain under ~/.particle/toolchains, downloading it when missing',
		choices: COMPILERS,
		default: DEFAULT_COMPILER
	}
});

module.exports = {
	COMPILERS,
	DEFAULT_COMPILER,
	compilerOption
};
