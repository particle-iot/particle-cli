var fs = require('fs');
var extend = require('xtend');

var settings = {
    commandPath: "./commands/",
    apiUrl: "https://api.spark.io",
    access_token: null,
    minimumApiDelay: 500,

    useOpenSSL: true,
    useSudoForDfu: false,

    //2 megs -- this constant here is arbitrary
    MAX_FILE_SIZE: 1024 * 1024 * 2
};

settings.commandPath = __dirname + "/commands/";



try {
    var overrides = __dirname + "/spark.config.json";
    if (fs.existsSync(overrides)) {
        settings = extend(settings, JSON.parse(fs.readFileSync(overrides)));
    }
} catch (ex) {
    console.error('There was an error reading ' + overrides + ': ', ex);
}
module.exports = settings;
