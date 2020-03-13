module.exports = {
	username(username) {
		return {
			type: 'input',
			name: 'username',
			message: 'Please enter your email address:',
			default: username,
			validate: (value) => {
				if (!value) {
					return 'You need an email address to log in, silly!';
				}
				return true;
			}
		};
	},

	password(msg) {
		return {
			type: 'password',
			name: 'password',
			message: msg || 'Please enter your password:',
			validate: (value) => {
				if (!value) {
					return 'You need a password to log in, silly!';
				}
				return true;
			}
		};
	},

	requestTransfer() {
		return {
			type: 'confirm',
			name: 'transfer',
			message: 'That device belongs to someone else. Would you like to request a transfer?',
			default: true
		};
	},

	areYouSure(msg) {
		return {
			type: 'confirm',
			name: 'sure',
			message: `Are you sure ${msg}?`,
			default: false
		};
	}
};
