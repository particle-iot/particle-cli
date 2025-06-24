const { expect } = require('../../test/setup');
const secrets = require('./secrets');
const nock = require('nock');
const { emptySecretsList, secretsList, secretGenericResponse, formattedSecretList, formattedGenericSecretGet } = require('../../test/secrets/fixtures');
const ParticleAPI = require('../cmd/api');

function createAPI() {
	return new ParticleAPI('https://api.particle.io', {
		accessToken: 'abc123'
	});
}

describe('secrets', () => {
	const baseUrl = 'https://api.particle.io/v1/';
	const api = createAPI();
	describe('list', () => {
		it('returns an empty list if there are no secrets', async () => {
			nock(baseUrl)
				.intercept('/secrets', 'GET')
				.reply(200, emptySecretsList);

			const secretsResponse = await secrets.list({ api });
			expect(secretsResponse).to.deep.equal([]);
		});

		it('returns a list of secrets', async () => {
			nock(baseUrl)
				.intercept('/secrets', 'GET')
				.reply(200, secretsList);
			const secretsResponse = await secrets.list({ api });
			expect(secretsResponse).to.deep.equal(formattedSecretList);
		});

		it('returns a list of org secrets', async () => {
			const orgId = 'my-org';
			nock(baseUrl)
				.intercept(`/orgs/${orgId}/secrets`, 'GET')
				.reply(200, secretsList);
			const secretsResponse = await secrets.list({ api, org: orgId });
			expect(secretsResponse).to.deep.equal(formattedSecretList);
		});
	});

	describe('create secret', () => {
		it('creates a secret', async () => {
			const secret = {
				name: 'SECRET_NAME',
				value: 'value'
			};
			nock(baseUrl)
				.intercept('/secrets', 'POST')
				.reply(200, secretGenericResponse);
			const secretResponse = await secrets.create({ api, ...secret });
			expect(secretResponse).to.deep.equal(formattedGenericSecretGet);
		});

		it('creates an org secret', async () => {
			const secret = {
				name: 'SECRET_NAME',
				value: 'value'
			};
			const orgId = 'my-org';
			nock(baseUrl)
				.intercept(`/orgs/${orgId}/secrets`, 'POST')
				.reply(200, secretGenericResponse);
			const secretResponse = await secrets.create({ api, ...secret, org: orgId });
			expect(secretResponse).to.deep.equal(formattedGenericSecretGet);
		});

		it('throws an error if secret key is empty', async () => {
			const secret = {
				name: '',
				value: 'value'
			};
			const org = 'my-org';
			const secretResponse = secrets.create({ api, ...secret, org });
			await expect(secretResponse).to.be.rejectedWith('Keys may include only uppercase letters, digits, and underscores, and must not begin with a digit.');
		});
		it('throws an error if secret key is not uppercase', async () => {
			const secret = {
				name: 'secret_name',
				value: 'value'
			};
			const secretResponse = secrets.create({ api, ...secret });
			await expect(secretResponse).to.be.rejectedWith('Keys may include only uppercase letters, digits, and underscores, and must not begin with a digit.');
		});

		it('throws an error in case api returns error', async () => {
			const secret = {
				name: 'MY_SECRET',
				value: 'value'
			};
			nock(baseUrl)
				.intercept('/secrets', 'POST')
				.reply(400, { ok: false, error: 'Failed to create secret: Name already in use' });
			const secretResponse = secrets.create({ api, ...secret });
			await expect(secretResponse).to.be.rejectedWith('Failed to create secret: Name already in use');
		});
	});

	describe('update secret', () => {
		it('returns updated secret', async () => {
			const secret = {
				name: 'SECRET_NAME',
				value: 'value'
			};
			nock(baseUrl)
				.intercept(`/secrets/${secret.name}`, 'PUT')
				.reply(200, secretGenericResponse);

			const secretResponse = await secrets.update({ api, ...secret });
			expect(secretResponse).to.deep.equal(formattedGenericSecretGet);
		});
		it('updates an org secret', async () => {
			const orgId = 'my-org';
			const secret = { name: 'SECRET_NAME', value: 'value' };
			nock(baseUrl)
				.intercept(`/orgs/${orgId}/secrets/${secret.name}`, 'PUT')
				.reply(200, secretGenericResponse);
			const secretResponse = await secrets.update({ api, ...secret, org: orgId });
			expect(secretResponse).to.deep.equal(formattedGenericSecretGet);
		});
	});

	describe('get secret', () => {
		it('returns an specific secret', async () => {
			const name = 'SECRET_NAME';
			nock(baseUrl)
				.intercept(`/secrets/${name}`, 'GET')
				.reply(200, secretGenericResponse);
			const secretResponse = await secrets.get({ api, name });
			expect(secretResponse).to.deep.equal(formattedGenericSecretGet);
		});

		it('returns an specific secret from org', async () => {
			const name = 'SECRET_NAME';
			const org = 'my-org';
			nock(baseUrl)
				.intercept(`/orgs/${org}/secrets/${name}`, 'GET')
				.reply(200, secretGenericResponse);
			const secretResponse = await secrets.get({ api, name, org });
			expect(secretResponse).to.deep.equal(formattedGenericSecretGet);
		});

		it('throws an error in case there is no secret with the given name', async () => {
			const name = 'SECRET_NAME';
			const errorMessage = 'HTTP error 404 from https://api.particle.io/v1/secrets/SECRET_NAME';
			nock(baseUrl)
				.intercept(`/secrets/${name}`, 'GET')
				.reply(404, { ok: false, error: 'not found' });
			const secretResponse = secrets.get({ api, name });
			await expect(secretResponse).to.be.rejectedWith(errorMessage);
		});

	});

	describe('delete secret', async () => {
		it('returns true in case the secret is removed from sandbox', async () => {
			const name = 'SECRET_NAME';
			nock(baseUrl)
				.intercept(`/secrets/${name}`, 'DELETE')
				.reply(204);
			const secretResponse = await secrets.remove({ api, name });
			expect(secretResponse).to.equal(true);
		});

		it('returns true in case the secret is removed from org', async () => {
			const name = 'SECRET_NAME';
			const orgId = 'my-org';
			nock(baseUrl)
				.intercept(`/orgs/${orgId}/secrets/${name}`, 'DELETE')
				.reply(204);
			const secretResponse = await secrets.remove({ api, name, org: orgId });
			expect(secretResponse).to.equal(true);
		});

		it('throws an error in case the secret is used and cannot be removed', async () => {
			const name = 'SECRET_NAME';
			const errorMessage = {
				ok: false,
				error: 'This secret cannot be deleted as it is being used by integrations or Logic Functions.'
			};
			const scope = nock(baseUrl)
				.intercept(`/secrets/${name}`, 'DELETE')
				.reply(400, errorMessage);

			const secretResponse = secrets.remove({ api, name });
			await expect(secretResponse).to.be.rejectedWith(errorMessage.error);
			scope.done();
		});

	});
});
