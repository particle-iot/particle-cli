const _waitForSsoValidation = async () => {
	// TODO: wait for validation completed
	return new Promise(resolve => setTimeout(resolve, 10000)).
		then(() => ({ token: 'xxx', username: 'username+sso@particle.io' }));

};

const ssoLogin = async () => {
	// TODO: login with sso
	return await _waitForSsoValidation();
};



module.exports = {
	ssoLogin
};
