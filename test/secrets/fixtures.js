// post response
// get response
// update response
const secretGenericResponse = {
	secret: {
		'name': 'HUGO_TEST_KEY',
		'created_at': '2025-06-17T14:05:52.401Z',
		'updated_at': '2025-06-17T14:05:52.401Z',
		'created_by': '60401d41668a672f2c3b75e4',
		'updated_by': '60401d41668a672f2c3b75e4',
		'last_accessed_at': null,
		'integrations': [{ name: 'Demo', id: '777c58bc69a5d4fd4ab53b59' }],
		'logic_functions': ['12345678-7729-4224-be94-abcdefc145f3']
	}
};

const secretOrgResponse = {
	secret: {
		'name': 'HUGO_TEST_KEY',
		'created_at': '2025-06-17T14:05:52.401Z',
		'updated_at': '2025-06-17T14:05:52.401Z',
		'created_by': '60401d41668a672f2c3b75e4',
		'updated_by': '60401d41668a672f2c3b75e4',
		'last_accessed_at': null,
		'integrations': [{ name: 'Demo', org_integration_id: '777c58bc69a5d4fd4ab53b59' }],
		'logic_functions': []
	}
};

// list secrets
const secretsList = {
	'secrets': [
		{
			'name': 'SECRET_01',
			'created_at': '2025-06-17T14:05:52.401Z',
			'updated_at': '2025-06-17T14:05:52.401Z',
			'created_by': '60401d41668a672f2c3b75e4',
			'updated_by': '60401d41668a672f2c3b75e4',
			'last_accessed_at': null,
			'integrations': [],
			'logic_functions': []
		},
		{
			'name': 'SECRET_02',
			'created_at': '2025-06-17T14:09:17.307Z',
			'updated_at': '2025-06-17T14:09:17.307Z',
			'created_by': '60401d41668a672f2c3b75e4',
			'updated_by': '60401d41668a672f2c3b75e4',
			'last_accessed_at': null,
			'integrations': [{ name: 'Demo', id: '777c58bc69a5d4fd4ab53b59' }],
			'logic_functions': []
		}
	]
};

const formattedSecretList = [
	{
		name: secretsList.secrets[0].name,
		createdAt: secretsList.secrets[0].created_at,
		updatedAt: secretsList.secrets[0].updated_at,
		lastAccessedAt: secretsList.secrets[0].last_accessed_at,
		usageCount: secretsList.secrets[0].integrations.length + secretsList.secrets[0].logic_functions.length,
	},
	{
		name: secretsList.secrets[1].name,
		createdAt: secretsList.secrets[1].created_at,
		updatedAt: secretsList.secrets[1].updated_at,
		lastAccessedAt: secretsList.secrets[1].last_accessed_at,
		usageCount: secretsList.secrets[1].integrations.length + secretsList.secrets[1].logic_functions.length,
	}
];
const formattedGenericSecretGet = {
	name: secretGenericResponse.secret.name,
	createdAt: secretGenericResponse.secret.created_at,
	updatedAt: secretGenericResponse.secret.updated_at,
	lastAccessedAt: secretGenericResponse.secret.last_accessed_at,
	logicFunctions: secretGenericResponse.secret.logic_functions,
	integrations: secretGenericResponse.secret.integrations,
};

const emptySecretsList = {
	secrets: []
};


module.exports = {
	secretGenericResponse,
	secretsList,
	secretOrgResponse,
	emptySecretsList,
	formattedSecretList,
	formattedGenericSecretGet
};
