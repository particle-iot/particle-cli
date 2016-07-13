// Set up the Mocha test framework with the Chai assertion library and
// the Sinon mock library

import 'babel-polyfill';
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);
const expect = chai.expect;

export {
	chai,
	sinon,
	expect
};
