'use strict';

const sandboxList = {
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
	'env': {
		inherited: {
			'FOO3': {
				value: 'org-bar3',
				access: ['Device']
			}
		},
		own: {
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
	'env': {
		inherited: {
			'FOO': {
				from: 'Owner',
				value: 'org-bar',
				access: ['Device']
			},
			'FOO3': {
				from: 'Product',
				value: 'prod-bar3',
				access: ['Device']
			},
			'FOO3_PROD': {
				from: 'Product',
				value: 'prod-bar3-prod',
				access: ['Device']
			},
		},
		own: {
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

const emptyList = { env : {} };

const emptyListWithKeys = { env: { inherited: {}, own: {} } };

module.exports = {
	sandboxList,
	sandboxProductList,
	sandboxDeviceProductList,
	emptyList,
	emptyListWithKeys,
};
