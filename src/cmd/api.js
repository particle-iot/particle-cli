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

	async deleteCurrentAccessToken(){
		return this._wrap(
			this.api.deleteCurrentAccessToken({
				auth: this.accessToken
			})
		);
	}

	/**
	 * @param {string} token
	 * @returns {Promise<void>}
	 */
	async revokeAccessToken(token) {
		return this._wrap(this.api.deleteAccessToken({ token }));
	}

	getUserInfo(){
		return this._wrap(
			this.api.getUserInfo({ auth: this.accessToken })
		);
	}

	listDevices(options){
		return this._wrap(
			this.api.listDevices(
				Object.assign({
					auth: this.accessToken
				}, options)
			)
		);
	}

	getDeviceAttributes(deviceId, product){
		return this._wrap(
			this.api.getDevice({
				product,
				deviceId,
				auth: this.accessToken
			})
		);
	}

	addDeviceToProduct(deviceId, product, file){
		return this._wrap(
			this.api.addDeviceToProduct({
				product,
				deviceId,
				file,
				auth: this.accessToken
			})
		);
	}

	markAsDevelopmentDevice(deviceId, development, product){
		return this._wrap(
			this.api.markAsDevelopmentDevice({
				development,
				deviceId,
				product,
				auth: this.accessToken
			})
		);
	}

	claimDevice(deviceId, requestTransfer){
		return this._wrap(
			this.api.claimDevice({
				// TODO (mirande): push these tweaks upstream to `particle-api-js`
				deviceId: (deviceId || '').toLowerCase(),
				requestTransfer: requestTransfer ? true : undefined,
				auth: this.accessToken
			})
		);
	}

	removeDevice(deviceId, product){
		return this._wrap(
			this.api.removeDevice({
				product,
				deviceId,
				auth: this.accessToken
			})
		);
	}

	renameDevice(deviceId, name){
		return this._wrap(
			this.api.renameDevice({
				deviceId,
				name,
				auth: this.accessToken
			})
		);
	}

	flashDevice(deviceId, files, targetVersion, product){
		return this._wrap(
			this.api.flashDevice({
				deviceId,
				product,
				// TODO (mirande): callers should provide an object like: { [filename]: filepath }
				files: files.map || files,
				targetVersion,
				auth: this.accessToken
			})
		);
	}

	signalDevice(deviceId, signal, product){
		return this._wrap(
			this.api.signalDevice({
				deviceId,
				product,
				signal,
				auth: this.accessToken
			})
		);
	}

	listDeviceOsVersions(platformId, internalVersion, perPage=100){
		return this._wrap(
			this.api.listDeviceOsVersions({
				platformId,
				internalVersion,
				perPage,
				auth: this.accessToken
			})
		);
	}

	compileCode(files, platformId, targetVersion){
		return this._wrap(
			this.api.compileCode({
				platformId,
				targetVersion,
				// TODO (mirande): callers should provide an object like: { [filename]: filepath }
				files: files.map || files,
				auth: this.accessToken
			})
		);
	}

	getVariable(deviceId, name, product){
		return this._wrap(
			this.api.getVariable({
				name,
				deviceId,
				product,
				auth: this.accessToken
			})
		);
	}

	callFunction(deviceId, name, argument, product){
		return this._wrap(
			this.api.callFunction({
				name,
				argument,
				deviceId,
				product,
				auth: this.accessToken
			})
		);
	}

	downloadFirmwareBinary(binaryId){
		return this._wrap(
			this.api.downloadFirmwareBinary({
				binaryId,
				auth: this.accessToken
			})
		);
	}

	getEventStream(deviceId, name, product){
		return this._wrap(
			this.api.getEventStream({
				name,
				deviceId,
				product,
				auth: this.accessToken
			})
		);
	}

	publishEvent(name, data, product){
		return this._wrap(
			this.api.publishEvent({
				name,
				data,
				product,
				isPrivate: true,
				auth: this.accessToken
			})
		);
	}

	getDeviceOsVersions(platformId, version) {
		return this._wrap(
			this.api.get({
				uri: `/v1/device-os/versions/${version}?platform_id=${platformId}`,
				auth: this.accessToken
			})
		);
	}

	getOrgs() {
		return this._wrap(
			this.api.get({
				uri: '/v1/orgs',
				auth: this.accessToken
			})
		);
	}

	getRegistrationCode(productId) {
		return this._wrap(
			this.api.post({
				uri: `/v1/products/${productId}/registration_code`,
				auth: this.accessToken
			})
		);
	}

	createProduct({ name, description = '', platformId, orgSlug, locationOptIn = false } = {}) {
		return this._wrap(
			this.api.post({
				uri: `/v1${orgSlug ? `/orgs/${orgSlug}` : '/user'}/products`,
				data: {
					product: {
						name,
						description,
						platform_id: platformId,
						settings: {
							location: {
								opt_in: locationOptIn
							}
						},
					}
				},
				auth: this.accessToken
			})
		);
	}

	getProducts(org) {
		return this._wrap(
			this.api.get({
				uri: `/v1${org ? `/orgs/${org}` : ''}/products`,
				auth: this.accessToken
			})
		);
	}

	getDevice({ deviceId: id }) {
		return this.api.getDevice({ deviceId: id, auth: this.accessToken });
	}

	getLogicFunctionList({ org }) {
		return this._wrap(this.api.listLogicFunctions({
			org: org,
			auth: this.accessToken,
		}));
	}

	executeLogicFunction({ org, logic }) {
		return this._wrap(this.api.executeLogic({
			org: org,
			logic: logic,
			auth: this.accessToken,
		}));
	}

	getLogicFunction({ org, id }) {
		return this._wrap(this.api.getLogicFunction({
			org: org,
			logicFunctionId: id,
			auth: this.accessToken,
		}));
	}

	deleteLogicFunction({ org, id }) {
		return this._wrap(this.api.deleteLogicFunction({
			org: org,
			logicFunctionId: id,
			auth: this.accessToken,
		}));
	}

	updateLogicFunction({ org, id, logicFunctionData }) {
		return this._wrap(this.api.updateLogicFunction({
			org: org,
			logicFunctionId: id,
			logicFunction: logicFunctionData,
			auth: this.accessToken
		}));
	}

	unprotectDevice({ deviceId, product, action, serverNonce, deviceNonce, deviceSignature, devicePublicKeyFingerprint, auth, headers, context }) {
		return this._wrap(this.api.unprotectDevice({
			deviceId,
			product,
			action,
			serverNonce,
			deviceNonce,
			deviceSignature,
			devicePublicKeyFingerprint,
			auth,
			headers,
			context
		}));
	}

	createLogicFunction({ org, logicFunction }) {
		return this._wrap(this.api.createLogicFunction({
			auth: this.accessToken,
			org,
			logicFunction
		}));
	}

	getProduct({ product, auth, headers, context }) {
		return this._wrap(this.api.getProduct({
			product,
			auth,
			headers,
			context
		}));
	}

	_wrap(promise){
		return Promise.resolve(promise)
			.then(result => result.body || result)
			.catch(this._checkToken);
	}

	_checkToken(err){
		const { UnauthorizedError } = module.exports;

		if ([400, 401].includes(err.statusCode)){
			const { body = {}, errorDescription, shortErrorDescription, } = err;
			let msg = shortErrorDescription;

			if (!msg){
				msg = body.error_description || body.error || errorDescription;
			}

			return Promise.reject(new UnauthorizedError(msg));
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

