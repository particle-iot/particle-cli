const log = require('./log');


module.exports = (name) => {
	try {
		return require(name);
	} catch (error){
		log.error(`The \`${name}\` dependency is missing or invalid.`);
		log.error('Please reinstall: https://docs.particle.io/tutorials/developer-tools/cli/#installing');
		throw error;
	}
};

