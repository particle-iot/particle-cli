const DeviceProtectionCommands = require('./device-protection');
const { expect, sinon } = require('../../test/setup');

describe('DeviceProtectionCommands', () => {
	let deviceProtectionCommands;

	beforeEach(() => {
		deviceProtectionCommands = new DeviceProtectionCommands();
		sinon.stub(deviceProtectionCommands, '_getUsbDevice').resolves();
		deviceProtectionCommands.device = {
			isInDfuMode: false,
			unprotectDevice: sinon.stub(),
			enterDfuMode: sinon.stub()
		};
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('getStatus', () => {
		it('should retrieve and display the protection status of the device', async () => {
			const expectedStatus = {
				protected: true,
				overridden: false
			};

			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves(expectedStatus);
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');

			const result = await deviceProtectionCommands.getStatus();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
			expect(deviceProtectionCommands._getDeviceString).to.have.been.calledOnce;
			expect(result).to.eql(expectedStatus);
		});

		it('throws an error while getting the protection status of the device', async () => {
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').rejects(new Error('random error'));

			let error;
			try {
				await deviceProtectionCommands.getStatus();
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.include('Unable to get device status: random error');
		});
	});

	describe('disableProtection', () => {
		it('should disable protection on the device', async () => {
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection')
				.onFirstCall().resolves({ protected: true, overridden: false })
				.onSecondCall().resolves({ protected: true, overridden: false });
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			deviceProtectionCommands.device = {
				unprotectDevice: sinon.stub().resolves({ protected: true, deviceNonce: '11111', deviceSignature: '22222', devicePublicKeyFingerprint: '33333' })
			};
			deviceProtectionCommands.api = {
				unprotectDevice: sinon.stub().resolves({ server_nonce: '44444', server_signature: '55555', server_public_key_fingerprint: '66666' })
			};


			await deviceProtectionCommands.disableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
			expect(deviceProtectionCommands.device.unprotectDevice).to.have.been.calledTwice;
			expect(deviceProtectionCommands.api.unprotectDevice).to.have.been.calledTwice;
		});

		it('handles already Open Devices', async () => {
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection')
				.onFirstCall().resolves({ protected: false, overridden: false });
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');

			await deviceProtectionCommands.disableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
		});
	});

	describe('enableProtection', () => {
		it('should enable protection on the device', async () => {
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves({
				protected: false,
				overridden: false
			});
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			sinon.stub(deviceProtectionCommands, '_isDeviceProtectionActiveInProduct').resolves(true);
			sinon.stub(deviceProtectionCommands,'_getProtectedBinary').resolves('/path/to/bootloader-protected.bin');
			sinon.stub(deviceProtectionCommands, '_downloadBootloader').resolves();
			sinon.stub(deviceProtectionCommands, '_flashBootloader').resolves();
			sinon.stub(deviceProtectionCommands, '_markAsDevelopmentDevice').resolves(true);

			await deviceProtectionCommands.enableProtection();

			expect(deviceProtectionCommands._getDeviceString).to.have.been.calledOnce;
			expect(deviceProtectionCommands._isDeviceProtectionActiveInProduct).to.have.been.calledOnce;
			expect(deviceProtectionCommands._downloadBootloader).to.have.been.calledOnce;
			expect(deviceProtectionCommands._flashBootloader).to.have.been.calledOnce;
			expect(deviceProtectionCommands._markAsDevelopmentDevice).to.have.been.calledOnce;
		});


		it('handles already Protected Devices', async () => {
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves({
				protected: true,
				overridden: false
			});
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			sinon.stub(deviceProtectionCommands, '_isDeviceProtectionActiveInProduct').resolves();

			await deviceProtectionCommands.enableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
			expect(deviceProtectionCommands._isDeviceProtectionActiveInProduct).to.not.have.been.called;
		});

		it('protects a Service Mode device', async () => {
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves({
				protected: true,
				overridden: true
			});
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			sinon.stub(deviceProtectionCommands, '_isDeviceProtectionActiveInProduct').resolves(true);
			sinon.stub(deviceProtectionCommands, '_markAsDevelopmentDevice').resolves(true);

			await deviceProtectionCommands.enableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
			expect(deviceProtectionCommands._isDeviceProtectionActiveInProduct).to.not.have.been.called;
		});

		it('does not protect an Open Device if it is not in a product', async () => {
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves({
				protected: false,
				overridden: false
			});
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			sinon.stub(deviceProtectionCommands, '_isDeviceProtectionActiveInProduct').resolves(false);
			sinon.stub(deviceProtectionCommands, '_markAsDevelopmentDevice').resolves(true);
			sinon.stub(deviceProtectionCommands, '_flashBootloader').resolves();

			await deviceProtectionCommands.enableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
			expect(deviceProtectionCommands._isDeviceProtectionActiveInProduct).to.have.been.calledOnce;
			expect(deviceProtectionCommands._markAsDevelopmentDevice).to.not.have.been.called;
			expect(deviceProtectionCommands._flashBootloader).to.not.have.been.called;
		});
	});

	describe('_getDeviceProtection', () => {
		it('should retrieve the current protection state of the device', async () => {
			const expectedState = {
				protected: true,
				overridden: false
			};
			deviceProtectionCommands.device = {
				getProtectionState: sinon.stub().resolves(expectedState)
			};

			const result = await deviceProtectionCommands._getDeviceProtection();

			expect(deviceProtectionCommands.device.getProtectionState).to.have.been.calledOnce;
			expect(result).eql(expectedState);
		});

		it('should throw an error if the device protection feature is not supported', async () => {
			deviceProtectionCommands.device = {
				getProtectionState: sinon.stub().rejects(new Error('Not supported'))
			};

			let error;
			try {
				await deviceProtectionCommands._getDeviceProtection();
			} catch (_e) {
				error = _e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.include('Device protection feature is not supported on this device');
		});

		it('throws a random error', async () => {
			deviceProtectionCommands.device = {
				getProtectionState: sinon.stub().rejects(new Error('random error'))
			};

			let error;
			try {
				await deviceProtectionCommands._getDeviceProtection();
			} catch (_e) {
				error = _e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.include('random error');
		});
	});

	describe('_flashBootloader', () => {
		xit('should flash the bootloader on the device', async () => {
			// TODO
		});
	});

	describe('_markAsDevelopmentDevice', () => {
		it('clears the device as a development device', async () => {
			let attributes = { development: true };
			deviceProtectionCommands.productId = 12345;
			deviceProtectionCommands.api = {
				getDeviceAttributes: sinon.stub().resolves(attributes),
				markAsDevelopmentDevice: sinon.stub().resolves()
			};

			let error;
			let res;
			try {
				res = await deviceProtectionCommands._markAsDevelopmentDevice(false);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.undefined;
			expect(res).to.eql(true);
		});

		it('does not clear development mode if not set', async () => {
			let attributes = { development: false };
			deviceProtectionCommands.productId = 12345;
			deviceProtectionCommands.api = {
				getDeviceAttributes: sinon.stub().resolves(attributes),
				markAsDevelopmentDevice: sinon.stub().resolves()
			};

			let error;
			let res;
			try {
				res = await deviceProtectionCommands._markAsDevelopmentDevice(false);
			} catch (e) {
				error = e;
			}

			expect(deviceProtectionCommands.api.markAsDevelopmentDevice).to.not.have.been.called;
			expect(error).to.be.undefined;
			expect(res).to.be.undefined;
		});

		it('returns false if the product ID is not available', async () => {
			deviceProtectionCommands.productId = null;

			let error;
			let res;
			try {
				res = await deviceProtectionCommands._markAsDevelopmentDevice(true);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.undefined;
			expect(res).to.eql(false);
		});

		it('returns false if an error occurs', async () => {
			deviceProtectionCommands.productId = 12345;
			deviceProtectionCommands.api = {
				getDeviceAttributes: sinon.stub().rejects(new Error('random error'))
			};

			let error;
			let res;
			try {
				res = await deviceProtectionCommands._markAsDevelopmentDevice(true);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.undefined;
			expect(res).to.eql(false);
		});
	});

	describe('_isDeviceProtectionActiveInProduct', () => {
		it('should return true if device protection is active in the product', async () => {
			sinon.stub(deviceProtectionCommands, '_getProductId').resolves();
			deviceProtectionCommands.productId = '12345';
			deviceProtectionCommands.api = {
				getProduct: sinon.stub().resolves({
					product: {
						device_protection: 'active'
					}
				})
			};

			const res = await deviceProtectionCommands._isDeviceProtectionActiveInProduct();

			expect(res).to.eql(true);

		});

		it('should return false if device protection is not active in the product', async () => {
			sinon.stub(deviceProtectionCommands, '_getProductId').resolves();
			deviceProtectionCommands.productId = '12345';
			deviceProtectionCommands.api = {
				getProduct: sinon.stub().resolves({
					product: {
						device_protection: ''
					}
				})
			};

			const res = await deviceProtectionCommands._isDeviceProtectionActiveInProduct();

			expect(res).to.eql(false);
		});

		it('should return false if device protection is not available for this product', async () => {
			sinon.stub(deviceProtectionCommands, '_getProductId').resolves();
			deviceProtectionCommands.productId = '12345';
			deviceProtectionCommands.api = {
				getProduct: sinon.stub().resolves({
					product: {
					}
				})
			};

			const res = await deviceProtectionCommands._isDeviceProtectionActiveInProduct();

			expect(res).to.eql(false);
		});
	});

	describe('_getProductId', () => {
		it('should retrieve the product ID of the device', async () => {
			deviceProtectionCommands.api = {
				getDeviceAttributes: sinon.stub().resolves({
					platform_id: 13,
					product_id: 12345
				})
			};

			const productIdBefore = deviceProtectionCommands.productId;
			await deviceProtectionCommands._getProductId();
			const productIdAfter = deviceProtectionCommands.productId;

			expect(productIdBefore).to.eql(null);
			expect(productIdAfter).to.eql(12345);
		});

		it('should set the product ID to null if an error occurs', async () => {
			it('should retrieve the product ID of the device', async () => {
				deviceProtectionCommands.api = {
					getDeviceAttributes: sinon.stub().rejects(new Error('random error'))
				};

				const productIdBefore = deviceProtectionCommands.productId;
				await deviceProtectionCommands._getProductId();
				const productIdAfter = deviceProtectionCommands.productId;

				expect(productIdBefore).to.eql(null);
				expect(productIdAfter).to.eql(null);
			});
		});
	});

	describe('_withDevice', () => {
		it('should execute a function with the device in normal (non-dfu) mode', async () => {
			const fn = sinon.stub().resolves();

			await deviceProtectionCommands._withDevice(true, fn);

			expect(deviceProtectionCommands._getUsbDevice).to.have.been.calledOnce;
			expect(fn).to.have.been.calledOnce;
		});

		it('should execute a function with the device in dfu mode', async () => {
			const fn = sinon.stub().resolves();
			deviceProtectionCommands.device.isInDfuMode = true;
			sinon.stub(deviceProtectionCommands, '_putDeviceInSafeMode').resolves();
			sinon.stub(deviceProtectionCommands, '_waitForDeviceToReboot').resolves();

			await deviceProtectionCommands._withDevice(true, fn);

			expect(deviceProtectionCommands._putDeviceInSafeMode).to.have.been.calledOnce;
			expect(deviceProtectionCommands._waitForDeviceToReboot).to.have.been.calledOnce;
			expect(fn).to.have.been.calledOnce;
		});
	});

	describe('_getDeviceString', () => {
		it('gets the device string', async() => {
			deviceProtectionCommands.deviceId = '0123456789abcdef';
			deviceProtectionCommands.productId = 12345;

			const res = await deviceProtectionCommands._getDeviceString();

			expect(res).to.eql('[0123456789abcdef] (Product 12345)');
		});
	});

	describe('getUsbDevice', () => {
		// TODO
	});

	describe('_resetDevice', () => {
		// TODO
	});

});
