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
settings.overridesFile = __dirname + "/spark.config.json";


settings.loadOverrides = function () {
    try {
        if (fs.existsSync(settings.overridesFile)) {
            settings.overrides = JSON.parse(fs.readFileSync(settings.overridesFile));
            settings = extend(settings, settings.overrides);
        }
    }
    catch (ex) {
        console.error('There was an error reading ' + settings.overrides + ': ', ex);
    }
};
settings.override = function (key, value) {
    if (!settings.overrides) {
        settings.overrides = {};
    }

    settings.overrides[key] = value;
    settings = extend(settings, settings.overrides);

    try {
        fs.writeFileSync(settings.overridesFile, JSON.stringify(settings.overrides));
    }
    catch (ex) {
        console.error('There was an error writing ' + settings.overrides + ': ', ex);
    }
};

settings.loadOverrides();
module.exports = settings;
