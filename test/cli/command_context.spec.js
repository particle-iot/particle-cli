import {expect, sinon} from '../test-setup';
import {test} from '../../src/cli/command_context';

const CommandContext = test.CommandContext;

describe('command context', () => {

	describe('context', () => {
		const user = { id: '123', email: 'fred@example.com' };

		it('retrieves the user via trackUser', () => {
			const sut = new CommandContext();
			const pkg = { version: '1.2.3' };
			const settings = { identity: user };
			return sut.context(pkg, settings)
				.then(context => {
					expect(context).to.be.ok;
					expect(context).to.have.property('user').eql(user);
					expect(context).to.have.property('api').with.property('key').that.is.ok;
					expect(context).to.have.property('tool').eql({name:'cli', version: '1.2.3'});
				});
		});

		it('returns the null identity', () => {
			const sut = new CommandContext();
			sut.identifyUser = sinon.stub().resolves({});
			const pkg = { version: '1.2.3' };
			const settings = { override: sinon.stub() };
			return expect(sut.context(pkg, settings)).to.eventually.have.property('user').eql(null);
		});
	});

});
