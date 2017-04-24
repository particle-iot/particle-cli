import {expect, sinon} from '../test-setup';
import {test} from '../../src/cli/command_context';

const CommandContext = test.CommandContext;

describe('command context', () => {

	describe('context object', () => {
		function commandContext() {
			const sut = new CommandContext();
			sut.identifyUser = () => Promise.resolve({id:'abcd', email:'someone@example.com'});
			return sut.context();
		}

		it('has user.id', () => {
			return expect(commandContext()).to.eventually.have.property('user').to.have.property('id').eql('abcd');
		});

		it('has user.email', () => {
			return expect(commandContext()).to.eventually.have.property('user').to.have.property('email').eql('someone@example.com');
		});

		it('has api.key', () => {
			return expect(commandContext()).to.eventually.have.property('api').to.have.property('key').to.be.ok;
		});

		it('has tool.name', () => {
			return expect(commandContext()).to.eventually.have.property('tool').to.have.property('name').to.eql('cli');
		});
	});

	describe('identifyUser', () => {
		it('rejects when api is not ready', () => {
			const sut = new CommandContext();
			const api = { ready: sinon.stub().returns(false) };
			return expect(sut.identifyUser(null, api)).to.eventually.be.rejected;
		});

		it('resolves with the user when ready', () => {
			const sut = new CommandContext();
			const user = {id:'123'};
			const api = { ready: sinon.stub().returns(true), identifyUser: sinon.stub().resolves(user) };
			return expect(sut.identifyUser(null, api)).to.eventually.eql(user);
		});
	});

	describe('isIdentity', () => {
		const isIdentity = new CommandContext().isIdentity;

		it('returns true when id and email are present', () => {
			expect(isIdentity({id:'123', email:'email'})).to.be.true;
		});

		it('returns false if any property is missing', () => {
			expect(isIdentity({id:'123'})).to.be.false;
			expect(isIdentity({email:'123'})).to.be.false;
		});

		it('returns false for a null reference', () => {
			expect(isIdentity(null)).to.be.false;
		});
	});

	describe('trackUser', () => {
		const user = { id: '123', email: 'biffa@viz.co.uk' };

		it('resolves the existing identity when already present in settings', () => {
			const sut = new CommandContext();
			sut.identifyUser = sinon.stub().throws(new Error('do not touch'));
			const settings = { identity: user };
			expect(sut.trackingUser(settings)).to.eventually.eql(user);
		});

		it('calls identifyUser when not already present in settings and saves it to settings', () => {
			const sut = new CommandContext();
			const settings = { override: sinon.stub() };
			sut.identifyUser = sinon.stub().resolves(user);
			return sut.trackingUser(settings)
				.then(user_ => {
					expect(user_).to.be.eql(user);
					expect(settings.override).calledWith(null, 'identity', user);
				});
		});

		it('calls identifyUser when not already present, and returns null if the fetched user fails the identify call', () => {
			const sut = new CommandContext();
			const settings = { override: sinon.stub() };
			sut.identifyUser = sinon.stub().resolves(user);
			sut.isIdentity = sinon.stub().returns(false);
			return sut.trackingUser(settings)
				.then(user_ => {
					expect(user_).to.be.eql(null);
					expect(settings.override).to.not.be.called;
				});
		});
	});

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
