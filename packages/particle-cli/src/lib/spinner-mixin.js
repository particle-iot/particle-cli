const Spinner = require('cli-spinner').Spinner;


module.exports = function spinnerMixin(obj) {
	Object.assign(obj, {
		newSpin(str) {
			this.__spin = new Spinner(str);
			return this.__spin;
		},
		startSpin() {
			if (!this.__spin){
				return;
			}
			this.__spin.start();
		},
		stopSpin() {
			if (!this.__spin){
				return;
			}
			this.__spin.stop(true);
		},
		stopSpinAfterPromise(promise) {
			return promise.then((value) => {
				this.stopSpin();
				return value;
			}, (error) => {
				this.stopSpin();
				throw error;
			});
		}
	});
};

