'use strict';
async function list({ api, org, sandbox } = {}) {
	const response = await api.listSecrets({ sandbox, orgSlug: org });
	return response.secrets?.length ? formatSecretList(response.secrets) : [];
}

async function get({ api, org, sandbox, name }) {
	const response = await api.getSecret({ sandbox, orgSlug: org, name });
	return formatSecret(response);
}

async function update({ api, org, sandbox, name, value } = {}) {
	// validate name
	const regex = /^[A-Z_][A-Z0-9_]*$/;
	if (!regex.test(name)) {
		throw new Error('Keys may include only uppercase letters, digits, and underscores, and must not begin with a digit.');
	}
	if (!value) {
		throw new Error('value is required');
	}
	const response = await api.updateSecret({ sandbox, orgSlug: org, name, value });
	return formatSecret(response);
}

async function remove({ api, org, sandbox, name } = {}) {
	const response = await api.removeSecret({ sandbox, orgSlug: org, name });
	if (!response.error) {
		return true;
	}
}

async function formatSecret(secretResponse) {
	const secret = secretResponse.secret;
	return {
		name: secret.name,
		createdAt: secret.created_at,
		updatedAt: secret.updated_at,
		lastAccessedAt: secret.last_accessed_at,
		logicFunctions: secret.logic_functions,
		integrations: secret.integrations,
	};
}

async function formatSecretList(secretList) {
	return secretList.map((secret) => {
		return {
			name: secret.name,
			createdAt: secret.created_at,
			updatedAt: secret.updated_at,
			lastAccessedAt: secret.last_accessed_at,
			usageCount: secret.integrations.length + secret.logic_functions.length,
		};
	});
}
module.exports = {
	list,
	update,
	remove,
	get
};
