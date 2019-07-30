const fs = require('fs');
const url = require('url');
const _ = require('lodash');
const chalk = require('chalk');
const Particle = require('particle-api-js');
const ParticleCmds = require('particle-commands');
const log = require('../lib/log');


module.exports = class ParticleApi {
	constructor(baseUrl, options){
		this.api = new Particle({
			baseUrl: baseUrl,
			clientId: options.clientId || 'particle-cli',
			clientSecret: 'particle-cli',
			tokenDuration: 7776000, // 90 days
			debug: this._debug.bind(this)
		});
		this.accessToken = options.accessToken;
	}

	login(username, password){
		return this.api.login({ username: username, password: password })
			.then(result => {
				this.accessToken = result.body.access_token;
				return this.accessToken;
			});
	}

	logout(){
		this.accessToken = undefined;
		return Promise.resolve();
	}

	removeAccessToken(username, password, token){
		return this.api.removeAccessToken({ username, password, token })
			.then(() => {
				if (token === this.accessToken){
					this.logout();
				}
			});
	}

	listDevices(){
		return this._wrap(this.api.listDevices({ auth: this.accessToken }));
	}

	getDeviceAttributes(deviceId){
		return this._wrap(this.api.getDevice({ deviceId, auth: this.accessToken }));
	}

	claimDevice(deviceId, requestTransfer){
		return this._wrap(this.api.claimDevice({ deviceId, requestTransfer, auth: this.accessToken }));
	}

	removeDevice(deviceId){
		return this._wrap(this.api.removeDevice({ deviceId, auth: this.accessToken }));
	}

	renameDevice(deviceId, name){
		return this._wrap(this.api.renameDevice({ deviceId, name, auth: this.accessToken }));
	}

	signalDevice(deviceId, signal){
		return this._wrap(this.api.signalDevice({ deviceId, signal, auth: this.accessToken }));
	}

	listBuildTargets(onlyFeatured){
		return this._wrap(this.api.listBuildTargets({ onlyFeatured, auth: this.accessToken }));
	}

	compileCode(files, platformId, targetVersion){
		return this._wrap(this.api.compileCode({ files, platformId, targetVersion, auth: this.accessToken }));
	}

	downloadFirmwareBinary(binaryId, downloadPath){
		return new Promise((resolve, reject) => {
			const req = this.api.downloadFirmwareBinary({ binaryId, auth: this.accessToken });
			req.pipe(fs.createWriteStream(downloadPath))
				.on('error', reject)
				.on('finish', resolve);
		});
	}

	getEventStream(deviceId, name){
		return this.api.getEventStream({ deviceId, name, auth: this.accessToken });
	}

	publishEvent(name, data, isPrivate){
		return this.api.publishEvent({ name, data, isPrivate, auth: this.accessToken });
	}

	_wrap(promise){
		return Promise.resolve(promise)
			.then(result => result.body)
			.catch(this._checkToken);
	}

	_checkToken(err){
		const { UnauthorizedError } = module.exports;

		if (err.statusCode === 401){
			return Promise.reject(new UnauthorizedError());
		}
		return Promise.reject(err);
	}

	_debug(req){
		if (global.verboseLevel > 3){
			const request = req.url ? req : req.req;
			let destUrl;

			// superagent vs plain http
			if (request.url){
				const parsedUrl = url.parse(request.url);
				parsedUrl.query = request.qs;
				destUrl = url.format(parsedUrl);
			} else {
				destUrl = `${request.path}`;
			}

			log.silly(chalk.underline('REQUEST'));
			log.silly(`${request.method.toUpperCase()} ${destUrl}`);
			const headers = (request.header || request._headers);

			if (headers && Object.keys(headers).length){
				log.silly(_.map(headers, (v, k) => {
					let val = v;
					if (k === 'authorization'){
						val = val.replace(this.accessToken, '<redacted>');
					}
					return `${k}: ${val}`;
				}).join('\n'));
			}

			if (request._data && Object.keys(request._data).length){
				const clonedData = Object.assign({}, request._data);
				if (clonedData.password){
					clonedData.password = '<redacted>';
				}
				log.silly(clonedData);
			}

			log.silly();
			req.on('response', res => {
				log.silly(chalk.underline('RESPONSE'));
				log.silly(`${request.method.toUpperCase()} ${destUrl}`);
				log.silly(res.statusCode);
				if (res.text || res.body){
					log.silly(res.text || res.body);
				}
				log.silly();
			});
		}
	}
};

module.exports.UnauthorizedError = class UnauthorizedError extends Error {
	constructor(message){
		super();
		this.message = message || 'Invalid access token';
		this.name = UnauthorizedError.name;
		if (typeof Error.captureStackTrace === 'function'){
			Error.captureStackTrace(this, UnauthorizedError);
		}
	}
};

module.exports.convertApiError = ParticleCmds.convertApiError;

