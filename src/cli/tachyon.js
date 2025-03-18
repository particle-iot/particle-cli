module.exports = ({ commandProcessor, root }) => {
	const tachyon = commandProcessor.createCategory(root, 'tachyon', 'Setup Particle devices');

	commandProcessor.createCommand(tachyon, 'setup', 'Setup a Tachyon device', {
		options: {
			skip_flashing_os: {
				description: 'Skip flashing the Operating System',
				boolean: true
			},
			version: {
				description: 'Version to download package for (default: latest). Can include a directory or a local zip file'
			},
			load_config: {
				description: 'Path to a config file to use for setup'
			},
			save_config: {
				description: 'Path to dump the config file to after setup'
			},
			region: {
				description: 'Region to download package for'
			},
			timezone: {
				description: 'Timezone to set on the device, like America/Los_Angeles. Defaults to the timezone of this computer.'
			},
			variant: {
				description: 'Variant of the Tachyon package to download'
			},
			board: {
				description: 'Board to download package for'
			},
			skip_cli: {
				description: 'Do not log in the Particle CLI',
				type: 'boolean'
			}
		},
		handler: (args) => {
			const SetupTachyonCommands = require('../cmd/setup-tachyon');
			return new SetupTachyonCommands().setup(args);
		},
		examples: {
			'$0 $command': 'Setup a Tachyon device'
		}
	});

	commandProcessor.createCommand(tachyon, 'download-package', 'Download a Tachyon package', {
		options: {
			region: {
				description: 'Region to download package for',
				type: 'string',
			},
			version: {
				description: 'Version to download package for',
				type: 'string'
			},
			variant: {
				description: 'Variant of the Tachyon package to download',
				type: 'string'
			},
			board: {
				description: 'Board to download package for',
				type: 'string'
			}
		},
		handler: (args) => {
			const DownloadTachyonPackageCommand = require('../cmd/download-tachyon-package');
			return new DownloadTachyonPackageCommand().download(args);
		},
		examples: {
			'$0 $command --region': 'Download a Tachyon package for the US region and version 1.0.0',
			'$0 $command --region NA --version 1.0.0': 'Download a Tachyon package for the North America region and version 1.0.0'
		}
	});

	commandProcessor.createCommand(tachyon, 'clean-cache', 'Clean the Tachyon package cache', {
		options: {
			region: {
				description: 'Region to download package for',
				type: 'string',
			},
			version: {
				description: 'Version to download package for',
				type: 'string'
			},
			variant: {
				description: 'Variant of the Tachyon package to download',
				type: 'string'
			},
			board: {
				description: 'Board to download package for',
				type: 'string'
			},
			all: {
				description: 'Clean all cached packages',
				boolean: true
			}
		},
		handler: (args) => {
			const CleanPackageCacheCommand = require('../cmd/download-tachyon-package');
			return new CleanPackageCacheCommand().cleanUp(args);
		},
		examples: {
			'$0 $command --region NA --version 1.0.0': 'Clean the Tachyon package cache for the North America region and version 1.0.0',
			'$0 $command --all': 'Clean all cached packages',
		}
	});

	commandProcessor.createCommand(tachyon, 'ext4', '', {
		handler: async () => {
			const { withMountedDisk } = require('ext2fs');
			const { FileDisk, withOpenFile } = require('file-disk');

			const diskImage = '/home/monkbroc/TachyonImages/persist.img';
			const offset = 0;  // offset of the ext partition you want to mount in that disk image
			try {
				await withOpenFile(diskImage, 'r', async (handle) => {
					const disk = new FileDisk(handle);
					await withMountedDisk(disk, offset, async ({promises:fs}) => {
						// List files
						console.log('readdir', await fs.readdir('/'));
						await fs.trim();
						// Show discarded regions
						console.log('discarded', disk.getDiscardedChunks());
						// Show ranges of useful data aligned to 1MiB
						console.log('ranges', await disk.getRanges(1024 ** 2));
					});
				});
			} catch (error) {
				console.error(error);
			}
		}
	});

	return tachyon;
};

