## Releasing a new version

- Checkout the `master` branch

- `npm version <major | minor | patch>`

This builds the distribution files.  Before the command finishes, update
`CHANGELOG.md`.

- `git push && git push --tag`

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

