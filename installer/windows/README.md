# Particle CLI Installer

Downloads and installs the latest CLI wrapper from binaries.particle.io,
executes it a first time to install Node.js and the particle-cli module.

*This installer is based on the CLI installer by Daniel Sullivan. Thanks!*

## Releasing the installer

- CircleCI builds and signs the executable on each git push 
- Download a specific branch installer from circleci artifacts and test it 
- After testing those installers, you can trigger a new release from particle-cli root repo

## Compile installer

- Download and install nsis version 3
- Run `npm run generate:win-installer` from root of particle-cli repo to get `ParticleCLISetup.exe` 

## Included components

See [licences.txt](/installer/windows/licenses.txt) for more info on the open source licenses.


## Release information
- Download the latest installer from  <https://binaries.particle.io/particle-cli/installer/windows/ParticleCLISetup.exe>
- Download the latest drivers installer from <https://binaries.particle.io/particle-cli/installer/windows/ParticleDriversSetup.exe>
