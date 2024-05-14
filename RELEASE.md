## Releasing a new version

- Checkout the `master` branch

	- Files have been updated and committed prior to this step.

- `npm version <major | minor | patch>`

	- This will bump the version in `package.json`, build the distribution files, prompt you to update the `CHANGELOG.md`, and make a "vX.Y.Z" commit for you.
	- e.g. going from 1.28.1 to 1.28.2 use `npm version patch`
	- e.g. going from 1.28.2 to 1.29.0 use `npm version minor`

- `git push origin master --follow-tags`

	- This will push the commits and tag created in the previous steps.

- GitHub Actions will publish to npm when the build succeeds.

- Create a release on GitHub with the notes from the `CHANGELOG.md`

## Create a test version on staging

- Run the following command:

  - `git push origin ${branch}:staging -f`

- In case you need to change the version, you can run the following command:

  - `npm version <major | minor | patch>`
  - Make sure to remove the created tag with `git tag -d vX.Y.Z` to prevent publishing to production.
  - Then, push the changes to staging again.
  - Once you are happy with the changes, you can proceed to merge the changes to master, remember to remove the version commit you just created.
  - The executables will be available on `binaries.staging.particle.io/particle-cli/` for testing.
