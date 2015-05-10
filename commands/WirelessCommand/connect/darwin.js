var exec = require('child_process').exec;
function darwin(opts, cb) {

	var params = 'networksetup -setairportnetwork en0 ' + opts.ssid;
	if(opts.password) { params += ' ' + opts.password; }

	// TODO: something with opts & interfaces?
	exec(params, results);
	function results(err, stdin, stderr) {

		if(err || stderr) {

			// TODO: more research into failure modes of this command
			return cb(err || stderr);
		}
		cb(null, opts);
	};
};

module.exports = darwin;
