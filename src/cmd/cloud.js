import fs from 'fs';
import path from 'path';
import pipeline from 'when/pipeline';
import _ from 'lodash';
import when from 'when';
import whenNode from 'when/node';
import glob from 'glob';

import log from '../app/log';
import settings from '../../settings';
import ParticleApi from './api';
import { platformsByName, notSourceExtensions, MAX_FILE_SIZE } from './constants';

const api = new ParticleApi(settings.apiUrl, {
	accessToken: settings.access_token
});

export default {
	login(user, pass) {
		return api.login(user, pass);
	},

	logout() {
		return api.logout();
	},

	removeAccessToken(user, pass, token) {
		return api.removeAccessToken(user, pass, token);
	},

	listDevices() {
		return api.listDevices();
	},

	listDevicesWithFunctionsAndVariables(filter) {
		return pipeline([
			api.listDevices.bind(api),
			(devices) => {
				return when.map(devices, d => {
					if (d.connected) {
						return api.getDeviceAttributes(d.id)
							.then(attrs => Object.assign(d, attrs));
					}
					return d;
				});
			},
			(devices) => {
				return _.sortBy(devices, 'name');
			},
			(devices) => {
				if (!filter) {
					return devices;
				}

				switch (true) {
					case (filter === 'online'):
						return devices.filter(d => d.connected);
					case (filter === 'offline'):
						return devices.filter(d => !d.connected);
					case (Object.keys(platformsByName).indexOf(filter.toLowerCase()) >= 0):
						return devices.filter(d => d.platform_id === platformsByName[filter.toLowerCase()]);
					default:
						return devices.filter(d => d.name === filter || d.id === filter);
				}
			}
		]);
	},

	claimDevice(deviceId, requestTransfer) {
		return api.claimDevice(deviceId, requestTransfer);
	},

	removeDevice(deviceIdOrName) {
		return api.removeDevice(deviceIdOrName);
	},

	renameDevice(deviceIdOrName, name) {
		return api.renameDevice(deviceIdOrName, name);
	},

	signalDevice(deviceIdOrName, onOff) {
		return api.signalDevice(deviceIdOrName, onOff);
	},

	listBuildTargets(onlyFeatured) {
		return api.listBuildTargets(onlyFeatured);
	},

	compileCode({ deviceType, filesOrFolder, target }) {
		const platformId = platformsByName[deviceType];
		if (platformId === undefined) {
			return when.reject('Invalid device type');
		}

		return pipeline([
			() => {
				if (!target || target === 'latest') {
					return;
				}

				return this.listBuildTargets(true).then(data => {
					const validTargets = data.targets.filter(t => t.platforms.indexOf(platformId) >= 0);
					const validTarget = validTargets.filter(t => t.version === target)[0];

					if (!validTarget) {
						return when.reject(['Invalid build target version.', 'Valid targets:'].concat(_.map(validTargets, 'version')));
					}
					log.info(`Targeting version ${validTarget.version}`);
				});
			},
			() => {
				return this._processFileArguments(filesOrFolder);
			},
			(files) => {
				if (!files.length) {
					return when.reject('No source files to compile');
				}

				log.info('Including:');
				const fileMap = {};
				files.forEach(f => {
					log.info(`  ${f}`);
					fileMap[path.basename(f)] = f;
				});
				return api.compileCode(fileMap, platformId, target);
			}
		]);
	},

	downloadFirmwareBinary(binaryId, downloadPath) {
		return api.downloadFirmwareBinary(binaryId, downloadPath);
	},

	_readTrimBlankLinesAndComments(file) {
		const read = whenNode.lift(fs.readFile);
		return read(file).then(buf => {
			const lines = buf.toString().split('\n');
			return _.chain(lines)
				.map(l => l.trim())
				.compact()
				.filter(l => !l.match(/^#.*$/))
				.value();
		});
	},

	_processDirIncludes(dirname) {
		const dir = path.resolve(dirname);
		const includeFile = path.join(dir, 'particle.include');
		const excludeFile = path.join(dir, 'particle.exclude');
		let includes = ['*.h', '*.ino', '*.cpp', '*.c'];

		const stat = whenNode.lift(fs.stat);
		const liftGlob = whenNode.lift(glob);

		return pipeline([
			() => {
				return stat(includeFile).then(() => {
					return this._readTrimBlankLinesAndComments(includeFile).then(lines => {
						includes = lines;
					});
				}, () => {});
			},
			() => {
				return liftGlob(`${dir}/+(${includes.join('|')})`);
			},
			(fileList) => {
				return stat(excludeFile).then(() => {
					this._readTrimBlankLinesAndComments(excludeFile).then(lines => {
						return liftGlob(`${dir}/+(${lines.join('|')})`).then(exclude => {
							return _.difference(fileList, exclude);
						});
					});
				}, () => {});
			}
		]);
	},

	_processFileArguments(files) {
		log.silly(`processing file list: ${files}`);
		const stat = whenNode.lift(fs.stat);
		if (!files.length) {
			// default to current directory
			files.push('.');
		}

		return stat(files[0]).then(s => {
			if (s.isDirectory()) {
				return this._processDirIncludes(files[0]);
			} else if (s.isFile()) {
				return files;
			}
		}).then(incFiles => {
			return when.map(incFiles, f => stat(f))
				.then(stats => {
					stats.forEach((s, i) => s.name = incFiles[i]);
					return stats;
				});
		}).then(stats => {
			return _.chain(stats)
				.filter(s => s.isFile())
				.filter(s => notSourceExtensions.indexOf(path.extname(s.name)) === -1)
				.filter(s => s.size < MAX_FILE_SIZE)
				.map('name')
				.value();
		});
	}
};
