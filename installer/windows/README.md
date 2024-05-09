# Particle CLI Installer

Includes a version of the CLI with all Javascript files and Node packaged as a single file.

*This installer is based on the CLI installer by Daniel Sullivan. Thanks!*

## Releasing the installer

- GitHub Actions builds and signs the executable when the staging branch is pushed.
- Download the installer from binaries.staging.particle.io and test it .
- After testing those installers, you can trigger a new release from particle-cli root repo.

## Compile installer

- Download and install nsis version 3
- Run `npm run generate:win-installer` from root of particle-cli repo to get `ParticleCLISetup.exe` 

## Included components

See [licences.txt](/installer/windows/licenses.txt) for more info on the open source licenses.


## Release Urls
- Download the staging installer from  <https://binaries.staging.particle.io/particle-cli/installer/windows/ParticleCLISetup.exe>
- Download the latest installer from  <https://binaries.particle.io/particle-cli/installer/windows/ParticleCLISetup.exe>
- Download the installer for a specific version from <https://binaries.particle.io/particle-cli/${version}/installer/windows/ParticleDriversSetup.exe>
