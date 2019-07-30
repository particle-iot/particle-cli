// Set up the Mocha test framework with the Chai assertion library and
// the testdouble library for mocks and stubs (previously Sinon mock library)
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);
const expect = chai.expect;

module.exports = {
	chai,
	sinon,
	expect
};
