var fs = require('fs');
var extend = require('xtend');

var settings = {
    commandPath: "./commands/",
    apiUrl: "https://api.spark.io",
    access_token: null,
    minimumApiDelay: 500,

    useOpenSSL: true,
    useSudoForDfu: false
};

settings.commandPath = __dirname + "/commands/";



try {
    var overrides = "spark.config.json";
    if (fs.existsSync(overrides)) {
        settings = extend(settings, JSON.parse(fs.readFileSync(overrides)));
    }
} catch (ex) {
    console.error('There was an error reading ' + overrides + ': ', ex);
}
module.exports = settings;
