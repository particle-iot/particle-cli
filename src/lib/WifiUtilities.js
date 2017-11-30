/**
 * Created by middleca on 1/23/15.
 */


const when = require('when');
const pipeline = require('when/pipeline');
const wifiscanner = require('node-wifiscanner2');


const WifiUtilities = {

	scan() {
		let dfd = when.defer();
		wifiscanner.scan((err, data) => {
			if (err) {
				dfd.reject(err);
			} else {
				dfd.resolve(data);
			}
		});
		return dfd.promise;
	},

	objToArr(obj) {
		let arr = [];
		for (let key in obj) {
			if (obj.hasOwnProperty(key)) {
				arr.push(obj[key]);
			}
		}
		return arr;
	},

	/**
	 * Alphabetize, de-duplicate,
	 * @param {Array} list
	 * @returns {Promise} promise that resolves with the list
	 */
	cleanApList(list) {
		list = list.sort((a, b) => {
			if (a.ssid && !b.ssid) {
				return 1;
			} else if (b.ssid && !a.ssid) {
				return -1;
			}

			return a.ssid.localeCompare(b.ssid);
		});

		let names = {};
		list.map((a) => {
			names[a.ssid] = names[a.ssid] || a;
			if (a.signal_level > names[a.ssid].signal_level) {
				names[a.ssid] = a;
			}
		});

		list = WifiUtilities.objToArr(names);

		return when.resolve(list);
	},

	displayAPList(list) {
		console.log('I found these Wi-Fi Access Points:');

		let lines = list.map((ap, idx) => {
			if (!ap) {
				return '';
			}

			//only show quotes if there is weird whitespace
			if (ap.ssid !== ap.ssid.trimLeft().trimRight()) {
				ap.ssid = '"' + ap.ssid + '"';
			}

			let arr = [
				idx + 1,
				'.)\t',
				ap.ssid
			];

			//only show channel info if we have it
			if (ap.channel) {
				arr.push('\t\t + (channel ' + ap.channel + ')');
			}

			return arr.join('');
		});

		console.log(lines.join('\n'));
		return when.resolve();
	},

	scanAndListAPs() {
		return pipeline([
			WifiUtilities.scan,
			WifiUtilities.cleanApList,
			WifiUtilities.displayAPList
		]);
	}
};
module.exports = WifiUtilities;
