// TODO (hmontero): Migrate it to node-wifiscanner2
// since airport is deprecated we need to change it
// https://apple.stackexchange.com/questions/471886/how-to-replace-functionality-of-deprecated-airport-command-line-application

const execa = require('execa');
const macProvider = '/usr/sbin/system_profiler';


async function scan() {
	const { stdout } = await execa(macProvider, [
		'SPAirPortDataType',
		'-detailLevel',
		'full',
		'-json'
	]);

	const data = JSON.parse(stdout);
	return parseAirportData(data);
}

async function parseAirportData(systemProfilerAirport) {
	const airPortData = systemProfilerAirport.SPAirPortDataType[0];
	const interfaces = airPortData.spairport_airport_interfaces;
	const en0Interface = interfaces.find(iface => iface._name === 'en0');
	const networks = en0Interface.spairport_airport_other_local_wireless_networks;

	// filter repeated networks
	const uniqueNetworks = networks ? filterUniqueNetworks(networks): [];

	return uniqueNetworks.map(formatNetwork);
}

function filterUniqueNetworks(networks) {
	const seen = new Set();
	return networks.filter(net => {
		if (!net._name || seen.has(net._name)) {
			return false;
		}
		seen.add(net._name);
		return true;
	});
}

function formatNetwork(network) {
	const [signal, noise] = (network.spairport_signal_noise || '').split('/').map(v => v.trim());
	const matchChannel = network.spairport_network_channel?.match(/^(\d+)/);
	const channel = matchChannel ? matchChannel[1] : '';
	const security = networkSecurity(network.spairport_security_mode);
	return {
		ssid: network._name,
		mac: '',
		channel,
		signal_level: signal || '',
		noise,
		security
	};
}

function networkSecurity(securityMode) {
	if (!securityMode) {
		return 'none';
	}
	if (securityMode.includes('_wpa3')) {
		return 'wpa3';
	}
	if (securityMode.includes('_wpa2')) {
		return 'wpa2';
	}
	if (securityMode.includes('_wpa')) {
		return 'wpa';
	}
	if (securityMode.includes('_wep')) {
		return 'wep';
	}
	if (securityMode.includes('_none')) {
		return 'none';
	}
	return 'unknown';
}

module.exports = {
	scan
};

