## Releasing a new version

- Checkout the `master` branch

	- Files have been updated and committed prior to this step.

- `npm version <major | minor | patch>`

	- This will bump the version in `package.json`, build the distribution files, prompt you to update the `CHANGELOG.md`, and make a "vX.Y.Z" commit for you.
	- e.g. going from 1.28.1 to 1.28.2 use `npm version patch`
	- e.g. going from 1.28.2 to 1.29.0 use `npm version minor`

- `git push && git push --tag`

	- This will push the commits and tag created in the previous steps.

- Travis will publish to npm when the build succeeds.

- Create a release on GitHub with the notes from the `CHANGELOG.md`

## Create a pre-release

- Switch to a feature branch (if on `master` the prerelease will be published to npm)

- `npm version x.y.z-beta.n` where x.y.z is a version not released yet
and beta.n is a name for this prerelease.

- `npm pack` to build a tarball of the CLI.

- `git push && git push  --tag`

- Create a pre-release on Github and attach the packed tarball.

- Tell beta users to install with
`npm install -g https://github.com/particle-iot/particle-cli/releases/download/vx.y.z-beta.n/particle-cli-x.y.z-beta.n.tgz`

