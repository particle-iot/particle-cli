/**
 * Created by middleca on 1/23/15.
 */

var when = require('when');
var pipeline = require('when/pipeline');
var prompts = require('./prompts.js');
var wifiscanner = require('node-wifiscanner2');


var WifiUtilities = {

	scan: function() {
		var dfd = when.defer();
		wifiscanner.scan(function(err, data) {
			if (err) {
				dfd.reject(err);
			}
			else {
				dfd.resolve(data);
			}
		});
		return dfd.promise;
	},

	objToArr: function(obj) {
		var arr = [];
		for(var key in obj) {
			if (obj.hasOwnProperty(key)) {
				arr.push(obj[key]);
			}
		}
		return arr;
	},

	/**
	 * Alphabetize, de-dupliate,
	 * @param list
	 * @returns {*}
	 */
	cleanApList: function(list) {
		list = list.sort(function(a, b) {
			if (a.ssid && !b.ssid) { return 1; }
			else if (b.ssid && !a.ssid) { return -1; }

			return a.ssid.localeCompare(b.ssid);
		});

		var names = {};
		list.map(function(a) {
			names[a.ssid] = names[a.ssid] || a;
			if (a.signal_level > names[a.ssid].signal_level) {
				names[a.ssid] = a;
			}
		});

		list = WifiUtilities.objToArr(names);

		return when.resolve(list);
	},

	displayAPList: function(list) {
		console.log("I found these Wi-Fi Access Points:");

		var formatLine = function(ap, idx) {
			if (!ap) { return ""; }

			//only show quotes if there is weird whitespace
			if (ap.ssid != ap.ssid.trimLeft().trimRight()) {
				ap.ssid = "\"" + ap.ssid + "\"";
			}

			var arr = [
				idx + 1,
				".)\t",
				ap.ssid
			];

			//only show channel info if we have it
			if (ap.channel) {
				arr.push("\t\t + (channel " + ap.channel + ")");
			}

			return arr.join("");
		};

		var lines = list.map(formatLine);
		console.log(lines.join("\n"));
		return when.resolve();
	},

	scanAndListAPs: function() {
		return pipeline([
			WifiUtilities.scan,
			WifiUtilities.cleanApList,
			WifiUtilities.displayAPList
		]);
	},

	_: null
};
module.exports = WifiUtilities;
