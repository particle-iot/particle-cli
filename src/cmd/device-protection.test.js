const DeviceProtectionCommands = require('./device-protection');
const FlashCommand = require('./flash');
const { expect, sinon } = require('../../test/setup');
// const fs = require('fs-extra');
// const { createProtectedModule } = require('binary-version-reader');

describe('DeviceProtectionCommands', () => {
	let deviceProtectionCommands;

	beforeEach(() => {
		deviceProtectionCommands = new DeviceProtectionCommands();
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
	});

	describe('disableProtection', () => {
		it('should disable protection on the device', async () => {
			// Stub the necessary methods
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


			// Call the method
			await deviceProtectionCommands.disableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledTwice;
			expect(deviceProtectionCommands.device.unprotectDevice).to.have.been.calledTwice;
			expect(deviceProtectionCommands.api.unprotectDevice).to.have.been.calledTwice;
		});

		it('should disable protection on the device', async () => {
			// Stub the necessary methods
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
			sinon.stub(deviceProtectionCommands, '_downloadBootloader').resolves();
			sinon.stub(deviceProtectionCommands, '_flashBootloader').resolves();
			sinon.stub(deviceProtectionCommands,'_markAsDevelopmentDevice').resolves(true);


			// Call the method
			await deviceProtectionCommands.disableProtection({ open: true });

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledTwice;
			expect(deviceProtectionCommands.device.unprotectDevice).to.have.been.calledTwice;
			expect(deviceProtectionCommands.api.unprotectDevice).to.have.been.calledTwice;
			expect(deviceProtectionCommands._markAsDevelopmentDevice).to.have.been.calledOnce;
		});

		it('handles open devices', async () => {
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection')
				.onFirstCall().resolves({ protected: false, overridden: false });
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');

			// Call the method
			await deviceProtectionCommands.disableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
		});
	});

	describe('enableProtection', () => {
		it('should enable protection on the device', async () => {
			// Stub the necessary methods
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves({
				protected: false,
				overridden: false
			});
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			sinon.stub(deviceProtectionCommands, '_isDeviceProtectionActiveInProduct').resolves(true);
			sinon.stub(deviceProtectionCommands, 'protectBinary').resolves('/path/to/bootloader-protected.bin');
			sinon.stub(deviceProtectionCommands, '_downloadBootloader').resolves();
			sinon.stub(deviceProtectionCommands, '_flashBootloader').resolves();
			sinon.stub(deviceProtectionCommands, '_markAsDevelopmentDevice').resolves(true);

			// Call the method
			await deviceProtectionCommands.enableProtection();

			expect(deviceProtectionCommands._getDeviceString).to.have.been.calledOnce;
			expect(deviceProtectionCommands._isDeviceProtectionActiveInProduct).to.have.been.calledOnce;
			expect(deviceProtectionCommands._downloadBootloader).to.have.been.calledOnce;
			expect(deviceProtectionCommands._flashBootloader).to.have.been.calledOnce;
			expect(deviceProtectionCommands._markAsDevelopmentDevice).to.have.been.calledOnce;
		});


		it('handles already protected devices', async () => {
			// Stub the necessary methods
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves({
				protected: true,
				overridden: false
			});
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			sinon.stub(deviceProtectionCommands, '_isDeviceProtectionActiveInProduct').resolves();

			// Call the method
			await deviceProtectionCommands.enableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
			expect(deviceProtectionCommands._isDeviceProtectionActiveInProduct).to.not.have.been.called;
		});

		it('protects a service mode device', async () => {
			// Stub the necessary methods
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves({
				protected: true,
				overridden: true
			});
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			sinon.stub(deviceProtectionCommands, '_isDeviceProtectionActiveInProduct').resolves(true);
			sinon.stub(deviceProtectionCommands, '_markAsDevelopmentDevice').resolves(true);

			// Call the method
			await deviceProtectionCommands.enableProtection();

			expect(deviceProtectionCommands._getDeviceProtection).to.have.been.calledOnce;
			expect(deviceProtectionCommands._isDeviceProtectionActiveInProduct).to.have.been.calledOnce;
			expect(deviceProtectionCommands._markAsDevelopmentDevice).to.have.been.calledOnce;
		});

		it('does not protect an open device if it is not in a product', async () => {
			// Stub the necessary methods
			sinon.stub(deviceProtectionCommands, '_getDeviceProtection').resolves({
				protected: false,
				overridden: false
			});
			sinon.stub(deviceProtectionCommands, '_getDeviceString').resolves('[123456789abcdef] (Product 12345)');
			sinon.stub(deviceProtectionCommands, '_isDeviceProtectionActiveInProduct').resolves(false);
			sinon.stub(deviceProtectionCommands, '_markAsDevelopmentDevice').resolves(true);
			sinon.stub(deviceProtectionCommands, '_flashBootloader').resolves();

			// Call the method
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
	});

	describe('_flashBootloader', () => {
		it('should flash the bootloader on the device', async () => {
			const flashCmd = new FlashCommand();
			sinon.stub(flashCmd, 'flashLocal').resolves(true);

			let error;
			try {
				await deviceProtectionCommands._flashBootloader('/path/to/bootloader-protected.bin');
			} catch (e) {
				error = e;
			}

			expect(error).to.eql(undefined);
		});
	});

	describe('_markAsDevelopmentDevice', () => {
		it('should mark the device as a development device', async () => {
			deviceProtectionCommands.productId = 12345;
			deviceProtectionCommands.api = {
				markAsDevelopmentDevice: sinon.stub().resolves()
			};

			let error;
			let res;
			try {
				res = await deviceProtectionCommands._markAsDevelopmentDevice(true);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.undefined;
			expect(res).to.eql(true);
		});

		it('should return false if the product ID is not available', async () => {
			deviceProtectionCommands.productId = null;
			deviceProtectionCommands.api = {
				markAsDevelopmentDevice: sinon.stub().resolves()
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

		it('should return false if an error occurs', async () => {
			deviceProtectionCommands.productId = 12345;
			deviceProtectionCommands.api = {
				markAsDevelopmentDevice: sinon.stub().rejects(new Error('random error'))
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
		xit('should return true if device protection is active in the product', async () => {
		});

		xit('should return false if device protection is not active in the product', async () => {
		});

		xit('should return false if the product ID is not available', async () => {
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
		// TODO
	});

	describe('_getDeviceString', () => {
		// TODO
	});

	describe('getUsbDevice', () => {
		// TODO
	});

	describe('_resetDevice', () => {
		// TODO
	});

});