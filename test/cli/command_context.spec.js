import {expect} from '../test-setup';
import {commandContext} from '../../src/cli/command_context';


describe('command context', () => {

	it('has user.id', () => {
		return expect(commandContext()).to.eventually.have.property('user').to.have.property('id').to.be.ok;
	});

	it('has api.key', () => {
		return expect(commandContext()).to.eventually.have.property('api').to.have.property('key').to.be.ok;
	});

	it('has tool.name', () => {
		return expect(commandContext()).to.eventually.have.property('tool').to.have.property('name').to.eql('cli');
	});


});