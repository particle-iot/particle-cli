export default {
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
	}
};
