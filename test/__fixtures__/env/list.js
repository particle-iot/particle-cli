'use strict';

const sandboxList = {
	'last_snapshot': {
		'rendered': {
			'FOO3': 'bar3',
			'FOO2': 'bar',
			'FOO': 'bar'
		},
		'inherited': {},
		'own': {
			'FOO3': {
				'value': 'bar3'
			},
			'FOO2': {
				'value': 'bar'
			},
			'FOO': {
				'value': 'bar'
			}
		}
	},
	'env': {
		'own': {
			'FOO3': {
				'value': 'bar3',
				'access': [
					'Device'
				]
			},
			'FOO2': {
				'value': 'bar',
				'access': [
					'Device'
				]
			},
			'FOO': {
				'value': 'bar',
				'access': [
					'Device'
				]
			}
		}
	},
	'created_at': '2025-11-26T14:22:15.502Z',
	'updated_at': '2025-11-26T15:27:41.278Z',
	'created_by': '60468db2509eb004820e11e0',
	'updated_by': '60468db2509eb004820e11e0'
};

const sandboxProductList = {
	'last_snapshot': {
		'rendered': {
			'FOO3': 'bar3',
			'FOO': 'bar'
		},
		'inherited': {
			'FOO3': {
				'from': 'Owner',
				'value': 'org-bar3'
			}
		},
		'own': {
			'FOO3': {
				'value': 'bar3'
			},
			'FOO': {
				'value': 'bar'
			}
		}
	},
	'env': {
		'inherited': {
			'FOO3': {
				'from': 'Owner',
				'value': 'org-bar3',
				'access': ['Device']
			}
		},
		'own': {
			'FOO3': {
				'value': 'bar3',
				'access': [
					'Device'
				]
			},
			'FOO': {
				'value': 'bar',
				'access': [
					'Device'
				]
			}
		}
	},
	'created_at': '2025-11-26T14:22:15.502Z',
	'updated_at': '2025-11-26T15:27:41.278Z',
	'created_by': '60468db2509eb004820e11e0',
	'updated_by': '60468db2509eb004820e11e0'
};

const sandboxDeviceProductList = {
	'last_snapshot': {
		'rendered': {
			'FOO': 'org-bar',
			'FOO3': 'bar3',
			'FOO4': 'bar'
		},
		'inherited': {
			'FOO': {
				'from': 'Owner',
				'value': 'org-bar'
			},
			'FOO3': {
				'from': 'Product',
				'value': 'prod-bar3'
			},
			'FOO3_PROD': {
				'from': 'Product',
				'value': 'prod-bar3-prod'
			}
		},
		'own': {
			'FOO3': {
				'value': 'bar3'
			},
			'FOO4': {
				'value': 'bar'
			}
		}
	},
	'env': {
		'inherited': {
			'FOO': {
				'from': 'Owner',
				'value': 'org-bar',
				'access': ['Device']
			},
			'FOO3': {
				'from': 'Product',
				'value': 'prod-bar3',
				'access': ['Device']
			},
			'FOO3_PROD': {
				'from': 'Product',
				'value': 'prod-bar3-prod',
				'access': ['Device']
			}
		},
		'own': {
			'FOO3': {
				'value': 'bar3',
				'access': [
					'Device'
				]
			},
			'FOO4': {
				'value': 'bar',
				'access': [
					'Device'
				]
			}
		}
	},
	'created_at': '2025-11-26T14:22:15.502Z',
	'updated_at': '2025-11-26T15:27:41.278Z',
	'created_by': '60468db2509eb004820e11e0',
	'updated_by': '60468db2509eb004820e11e0'

};

const emptyList = {
	last_snapshot: { rendered: {}, inherited: {}, own: {} },
	env: {}
};

const emptyListWithKeys = {
	last_snapshot: { rendered: {}, inherited: {}, own: {} },
	env: { inherited: {}, own: {} }
};

module.exports = {
	sandboxList,
	sandboxProductList,
	sandboxDeviceProductList,
	emptyList,
	emptyListWithKeys
};
