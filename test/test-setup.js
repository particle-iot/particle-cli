// Set up the Mocha test framework with the Chai assertion library and
// the testdouble library for mocks and stubs (previously Sinon mock library)

import 'babel-polyfill';
import chai from 'chai';
import td from 'testdouble';
import tdChai  from "testdouble-chai";

import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(tdChai(td));
chai.use(sinonChai);
chai.use(chaiAsPromised);
const expect = chai.expect;

afterEach(() => td.reset());

export {
	chai,
	td,
	sinon,
	expect
};
