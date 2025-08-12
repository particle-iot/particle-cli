module.exports = ({ commandProcessor, root }) => {
	const tachyon = commandProcessor.createCategory(root, 'tachyon', 'Setup Particle devices');

	commandProcessor.createCommand(tachyon, 'setup', 'Setup a Tachyon device', {
		options: {
			skip_flashing_os: {
				description: 'Skip flashing the Operating System',
				boolean: true
			},
			version: {
				description: 'Version to download package for (default: stable). Can include a directory or a local zip file'
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
				boolean: true
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

	commandProcessor.createCommand(tachyon, 'backup', 'Backup Tachyon NV data', {
		options: {
			'output-dir': {
				description: 'Directory to save the backup files'
			},
			'log-dir': {
				description: 'Directory to save the log files'
			}
		},
		handler: (args) => {
			const BackupRestoreTachyonCommand = require('../cmd/backup-restore-tachyon');
			return new BackupRestoreTachyonCommand().backup(args);
		},
		examples: {
			'$0 $command ': 'Backup Tachyon NV data for a system update mode connected device',
			'$0 $command --output-dir /path/to/backup': 'Backup Tachyon NV data to the specified directory',
			'$0 $command --log-dir /path/to/log': 'Backup Tachyon NV data and save logs to the specified directory'
		}
	});

	commandProcessor.createCommand(tachyon, 'restore', 'Restore Tachyon NV data', {
		options: {
			'input-dir': {
				description: 'Directory containing the NV data files'
			},
			'log-dir': {
				description: 'Directory to save the log files'
			}
		},
		handler: (args) => {
			const BackupRestoreTachyonCommand = require('../cmd/backup-restore-tachyon');
			return new BackupRestoreTachyonCommand().restore(args);
		},
		examples: {
			'$0 $command ': 'Restore Tachyon NV data for a system update mode connected device using the default filenames',
			'$0 $command --input-dir /path/to/input': 'Restore Tachyon NV data from the specified directory using the default filenames',
			'$0 $command --log-dir /path/to/log': 'Restore Tachyon NV data and save logs to the specified directory',
		}
	});

	commandProcessor.createCommand(tachyon, 'identify', 'Identify a Tachyon device in EDL mode', {
		handler: (args) => {
			const IdentifyTachyonCommand = require('../cmd/identify-tachyon');
			return new IdentifyTachyonCommand().identify(args);
		},
		examples: {
			'$0 $command': 'Identify a Tachyon device'
		}
	});

	commandProcessor.createCommand(tachyon, 'factory-reset', 'Reset the tachyon with factory image', {
		options: {
			'reset-dir': {
				description: 'Directory to save the backup and restore files'
			}
		},
		handler: (args) => {
			const TachyonFactoryResetCommand = require('../cmd/tachyon-factory-reset');
			return new TachyonFactoryResetCommand(args).factoryReset(args);
		},
		examples: {
			'$0 $command': 'Reset the tachyon with factory image',
		}
	});

	return tachyon;
};

